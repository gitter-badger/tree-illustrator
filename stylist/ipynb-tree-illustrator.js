/*
 * This script can be imported into any IPython notebook (assumes the web UI)
 * to allow embedding the Tree Illustrator webapp, where it can read data from
 * the surrounding notebook and save results there. 
 * 
 * This should be useful in pre-publication and exploratory scenarios for a
 * single user, or fairly easy collaboration using Wakari or another notebook
 * server.
 * 
 * There are a few options for where the app would appear:
 *
 *   1. in a modal popup (in an IFRAME)
 *      This works best in a live (vs static HTML) notebook, where we an add a
 *      toolbar button and use IPython's built-in modal.
 *
 *   2. "inline" in a notebook cell (in an IFRAME)
 *      This makes a "static widget" in IPython parlance, so it should work
 *      even in a static HTML notebook. This allows multiple instances of Tree
 *      Illustrator to exist in different cells; is that useful?
 *
 *   3. in a new browser tab or window (esp. for static notebooks)
 *      This would need an additional bridge from the calling window to the new
 *      one. On the plus side, it should work in a live *or* static notebook.
 * 
 * In any case, we'll use cross-document messaging (postMessage) to provide
 * tree data from the surrounding IPython session and to save SVG output (or
 * complete illustration JSON) from the Tree Illustrator. [1,2]
 *
 * To use this, add a code cell to your IPython notebook and embed this script
 *   %%javascript
 *   $.getScript('https://rawgit.com/opentreeoflife/f16e.../raw/48b.../ipynb-tree-illustrator.js');
 *   ti = IPythonTreeIllustrator.IllustratorWidget();
 *   ti2 = IPythonTreeIllustrator.IllustratorWidget('(a,b,(c,d));');
 *
 * [1] https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * [2] http://caniuse.com/#search=postMessage
 */

var IPythonTreeIllustrator = function(window, document, $) {

    // Try to determine the URL of this script, so we can load adjacent files
    var currentScriptURL = $('script[src*="ipynb-tree-illustrator.js"]').last().attr('src');
    console.log('>>> Loading Tree Illustrator code from this URL: '+ currentScriptURL);

    // Are we running in a "live" notebook, or static HTML?
    var isLiveNotebook = $('body.notebook_app').length > 0;
    var isStaticNotebook = !(isLiveNotebook);

    // Define some enumerated values for callers.
    var SINGLETON = 'SINGLETON',
        TOOLBAR_BUTTON_ID = 'ti-toolbar-button',
        //TI_STATE_ID = 'ti-state-data',
        TI_HOME_CELL_ID = 'ti-home-cell';

    // Keep track of prefs and illustrations (in notebook metadata) 
    var state;

    // Generate the initial "state" object for a new Tree Illustrator widget
    var getInitialState = function() {
        return {
            "lastUpdate": new Date().toString(),
            "prefs": {}, 
            "illustrations": []
            // an ordered list of objects, each with name, author(?), spec, convertedTrees, svgOutput
        };
    }

    /* Freeze/thaw JSON data to/from a TEXTAREA or PRE element?
     * For now, we're going to use notebook metadata for this.
    var thawStateFromJSON = function() {
        var $stateHolder = $('#'+ TI_STATE_ID);
        if ($stateHolder.length) {
            // Load the existing state JSON
            state = JSON.parse( $stateHolder.text() ); 
        } else {
            // Use default (initial) state for a new Tree Illustrator
            state = defaultState;
        }
    }
    var freezeStateToJSON = function() {
        if (isStaticNotebook) {
            // We can only save changes in a live notebook!
            console.warn("IPythonTreeIllustrator.freezeStateToJSON(): disabled in a static notebook!");
            return;
        }
        var $stateHolder = $('#'+ TI_STATE_ID);
        if ($stateHolder.length === 0) {
            var msg = "State (JSON) holder not found! Unable to save state for Tree Illustrator!";
            console.warn(msg);
            alert(msg);
            return;
        }
        $stateHolder.text( JSON.stringify(state));
        IPython.notebook.save_notebook();
    }
    */

    // Keep track of all active instances (widgets), keyed by element ID
    var widgets = { };

    // Assign unique, serial element IDs
    var nextAvailableWidgetID = 0;

    var getNextAvailableWidgetID = function( ) {
        // creates a serial ID like 'tree-illustrator-4'
        var readyID = nextAvailableWidgetID;
        nextAvailableWidgetID = readyID + 1;
        return ('tree-illustrator-'+ readyID);
    } 

    var IllustratorWidget = function(target, data) {
        if ( !(this instanceof IllustratorWidget) ) {
            console.warn("MISSING 'new' keyword for IllustratorWidget, patching this now");
            return new IllustratorWidget(data);
        }

        // Safely refer to this instance below
        var self = this;
        var elementID = getNextAvailableWidgetID();

        /* define PRIVATE members (variables and functions ) with 'var' */

        var getIframeMarkup = function() {
            // TODO: add version/SHA argument here?
            return '<iframe id="'+ elementID +'" width="100%" height="500" \
                            src="http://rawgit.com/OpenTreeOfLife/tree-illustrator/master/stylist/stylist.html" \
                            frameborder="0" allowfullscreen="allowfullscreen"> \
                    </iframe>';
        }

        var showInNewWindow = function() {
            // TODO: Show the Tree Illustrator in a new browser window or tab, with a link
            // back to the calling window.
            alert('showInNewWindow(): COMING SOON');
        }

        var showInNotebookCell = function(cell) {
            // create my IFRAME element in the output of the current notebook cell
            
            // N.B. This ID is mostly for internal use; user probably calls this something else
            cell.append_display_data({
              'data': {
                'text/html': getIframeMarkup()
              } 
            })
        }

        var showInModalPopup = function(data) {
            // Use IPython's support for a single modal popup, adapted from
            // https://github.com/minrk/ipython_extensions/blob/70ed77bd7fd36fbead09a1df41f93cab5cfdfe92/nbextensions/gist.js
            //var modal = IPython.dialog.parentModule.modal({
            var dialog = require("base/js/dialog");
            var modal = dialog.modal({
                title: "Tree Illustrator",
                body: $(getIframeMarkup()),
                buttons : {
                    //"Cancel": {},
                    "Close": {
                        class: "btn-primary",
                        click: function () {
                            // TODO: update TI header cell
                            console.log('clicked Close button (closes popup?)');
                            /*
                            var token = $(this).find('input').val();
                            localStorage[token_name] = token;
                            gist_notebook();
                            */
                        }
                    }
                },
                open : function (event, ui) {
                    // Cosmetic tweaks to the modal popup
                    var $titleArea = $('h4.modal-title:contains(Tree Illustrator)');
                    var $modalHeader = $titleArea.closest('.modal-header');
                    var $modalDialog = $modalHeader.closest('.modal-dialog');
                    $titleArea.prepend('<img src="//tree.opentreeoflife.org/favicon.ico"'
                                          +' style="width:24px; height: 24px; display: inline-block; margin: -7px 0 -5px -5px;">');
                    $modalHeader.css('padding', '8px 15px'); 
                    $modalDialog.css({'width':'90%', 'height':'90%'}); // almost fills the window

                    // TODO: load initial data?
                    /*
                    var that = $(this);
                    // Upon ENTER, click the OK button.
                    that.find('input[type="text"]').keydown(function (event, ui) {
                        if (event.which === 13) {
                            that.find('.btn-primary').first().click();
                            return false;
                        }
                    });
                    that.find('input[type="text"]').focus().select();
                    */
                }
            });
        };

        /* TODO: define PUBLIC variables (and privileged methods) with 'self' */

        // Initialize this instance using one of the methods above

        if (!data || typeof(data) !== 'object') {
            // instance will load the "empty" illustration as usual?
            console.log("No data specified for Tree Illustrator, will use placeholders.");
        }

        if (target === SINGLETON) {
            if (isLiveNotebook) {
                // Use the modal popup support in IPython
                showInModalPopup(data);
            } else {  // it's a static HTML notebok
                // Use a new browser window or tab
                showInNewWindow(data);
            }
        } else {
            // try to embed in a specified cell
            if (target && ('append_output' in target)) {
            ///if (target && (target instanceof OutputArea)) {
                showInNotebookCell(target);
            } else {
                if (isLiveNotebook) {
                    alert("Missing notebook cell as first argument! Try 'this':"
                        + "\n  var ti = new IPythonTreeIllustrator.IllustratorWidget(this);");
                } else {
                    alert("REMINDER: Tree Illustrator can't be embedded in a cell in the static HTML notebook!");
                }
                return null;
            }
        }

        var elementSelector = ('#'+ elementID);
        self.ti_element = $(elementSelector)[0];
        self.ti_window = self.ti_element.contentWindow;
        
        // add this instance to the registry above
        widgets[elementID] = self;
    }

    var updateHomeCell = function() {
        // Refresh (or initialize) the home-cell display based on current state JSON
        var $homeCell = $('#'+ TI_HOME_CELL_ID);
        var $inputArea = $homeCell.find('.input');
        console.log("Updating the Tree Illustrator home cell...");
        // Hide the input area and enable the toggle
        $inputArea.hide();
        $homeCell.find('a.input-toggle')
                 .unbind('click')
                 .click(function() {
                     // show (or hide) the input area for this cell
                     var $toggle = $(this);
                     var $inputArea = $toggle.closest('.cell').find('.input');
                     if ($inputArea.is(':hidden')) {
                        $inputArea.show();
                        $toggle.text( $toggle.text().replace('Show','Hide') );
                     } else {
                        $inputArea.hide();
                        $toggle.text( $toggle.text().replace('Hide','Show') );
                     }
                 });
        // TODO: Update the prefs UI widgets
        // Update the list of illustrations
        var $illustrationsList = $homeCell.find('ul.illustration-list');
        $illustrationsList.empty();
        $.each(state.illustrations, function(ill) {
            // TODO: Add controls to re-order illustrations?
            var $illustrationEntry = $('<li><a class="illustration-name"></a> <i class="delete">X</i></li>');
            $illustrationsList.append( $illustrationEntry );
            $illustrationEntry.find('a.illustration-name')
                .html(ill.name || "Untitled illustration")
                .click(function() { 
                    // TODO: launch with this illustration! 
                    alert("Now I'd open this illustration!");
                 });
            $illustrationEntry.find('.delete')
                .click(function() {
                    if (prompt("Are you sure you want to delete this illustration? This cannot be undone!"
                              +" Enter 'YES' below to confirm.") === 'YES') {
                        // TODO: clobber this illustration from the list
                        alert("Now I'd delete this illustration and resave the notebook!");
                    }
                });
        });
    }

    var buildScriptRelativeURL = function( path ) {
        var pathParts = currentScriptURL.split('/').slice(0, -1);
        pathParts.push( path );
        return pathParts.join('/');
    }

    // Do other initial setup in the noteboo
    var initNotebookUI = function( $homeCellOutputArea ) {
        // Load any prior state, or initialize it if not found
        //thawStateFromJSON();
        if (!IPython.notebook.metadata.tree_illustrator) {
            IPython.notebook.metadata.tree_illustrator = getInitialState();
        }
        state = IPython.notebook.metadata.tree_illustrator;

        if (isStaticNotebook) {
            // There's no toolbar or available cell reference; nothing we can do here
            console.warn("IPythonTreeIllustrator.initNotebookUI(): disabled in a static notebook!");
            return;
        }
        console.log("IPythonTreeIllustrator.initNotebookUI(): starting...");
        
        // Add a button to the shared toolbar
        if ($('#'+ TOOLBAR_BUTTON_ID).length === 0) {
            console.log("IPythonTreeIllustrator.initNotebookUI(): adding toolbar button");
            IPython.toolbar.add_buttons_group([
                {
                    'label'   : 'Launch the Tree Illustrator',
                    'icon'    : 'fa-leaf', // from http://fortawesome.github.io/Font-Awesome/icons/
                            // for prefixed names, see http://cascade.io/icon-reference.html
                    'callback': function() {
                        var ti = new IPythonTreeIllustrator.IllustratorWidget(IPythonTreeIllustrator.SINGLETON);
                    },
                    'id'      : TOOLBAR_BUTTON_ID
                },
            ]);
            // let's give it a nicer look
            $('#'+ TOOLBAR_BUTTON_ID).html('<img src="//tree.opentreeoflife.org/favicon.ico"'
                                              +' style="width:18px; height: 18px; margin: -1px -3px 0px -4px;"> Tree Illustrator');
        }

        // Add a "home" cell to manage illustrations, if not found
        if ($homeCellOutputArea instanceof jQuery && $homeCellOutputArea.length) {
            // Test for existing home cell (incl. JSON state)
            var homeCellAlreadyExists = $('#'+ TI_HOME_CELL_ID).length > 0;
            if (homeCellAlreadyExists) {
                updateHomeCell();
            } else {
                // Load our template HTML into the new "home" cell
                if (!currentScriptURL) {
                    $homeCellOutputArea.append('<pre><div class="ansired"></div></pre>'); // mimic IPython notebook errors
                    $homeCellOutputArea.find('pre .ansired').text( "No URL found for this script!" );
                    return;
                }
                var tiHomeCellURL = buildScriptRelativeURL('ipynb-ti-home-cell.html');
                console.log(">>> Loading home-cell UI from this URL:"+ tiHomeCellURL);
                $homeCellOutputArea.load(tiHomeCellURL, function( response, status, xhr ) {
                    if ( status == "error" ) {
                        $homeCellOutputArea.append('<pre><div class="ansired"></div></pre>'); // mimic IPython notebook errors
                        var msg = "There was an error loading the Tree Illustrator UI:\n\n";
                        $homeCellOutputArea.find('pre .ansired').text( msg + xhr.status + " " + xhr.statusText );
                        return;
                    }
                    // Freeze any prior (or default) state to stored JSON
                    //freezeStateToJSON();
                    alert("Home cell loaded!");
                    updateHomeCell();
                });
            }
        } else {
            // No jQuery provided, or it's empty
            console.warn("IPythonTreeIllustrator.initNotebookUI(): No home cell defined!");
        }
        console.log("IPythonTreeIllustrator.initNotebookUI(): done!");
    }

    /* define PUBLIC methods (that don't need private data) in its prototype */
    IllustratorWidget.prototype = {
        constructor: IllustratorWidget,

        addTree: function(data) {
            var self = this;
            // TODO
        },
        dumpCurrentIllustration: function(data) {
            var self = this;
            // TODO
        },
        dumpCurrentIllustrationSVG: function(data) {
            var self = this;
            // TODO
        }

    }

    /* expose class constructors (and static methods) for instantiation */
    return {
        // expose enumerations
        SINGLETON: SINGLETON,
        TOOLBAR_BUTTON_ID: TOOLBAR_BUTTON_ID,
        TI_HOME_CELL_ID: TI_HOME_CELL_ID,
        //TI_STATE_ID: TI_STATE_ID,

        // expose static properties and methods
        initNotebookUI: initNotebookUI,
        isLiveNotebook: isLiveNotebook,
        isStaticNotebook: isStaticNotebook,

        // expose available classes
        IllustratorWidget: IllustratorWidget
    };
}(window, document, $);
