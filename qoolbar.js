// qoolbar.js - a menu of qiki verb icons to apply to things on a web page.
'use strict';

(function (window, qoolbar, $) {
    if (typeof qoolbar !== 'object') {
        console.error("The qoolbar.js module doesn't appear to be included.");
    }
   if (typeof $ !== 'function') {
        console.error("The qoolbar.js module requires jQuery.");
    } else if (typeof $.ui === 'undefined') {
        console.error("The qoolbar.js module requires jQuery UI.");
    }
    qoolbar.is_ready = false;

    qoolbar.MAX_DROP_FILE_SIZE = 1000;
    qoolbar._ajax_url = null;
    qoolbar.ajax_url = function qoolbar_ajax_url(url) {
        qoolbar._ajax_url = url;
    };
    qoolbar.ICON_ENTRY_TOP_FUDGE = -3;   // Correspond to bottom padding and margin
    qoolbar.ICON_ENTRY_LEFT_FUDGE = 1;   // Correspond to left padding and margin
    var UNICODE_TIMES = '\u00D7';   // aka &times;

    $(window.document).ready(function () {

        /**
         * Build the qoolbar DOM, given an array of verb names and icons.
         *
         * @param verbs[]
         * @param verbs.length
         * @param verbs.name -- e.g. 'like'
         * @param verbs.idn
         * @param verbs.icon_url -- from the iconify sentence
         * @param verbs.qool_num -- 0 if deleted, 1 if not
         * @returns {*|HTMLElement}
         * @private
         */
        // NOTE:  Why does verbs.name work and not verbs[].name?
        //        http://usejsdoc.org/tags-param.html#parameters-with-properties
        function qoolbar_build(verbs) {
            qoolbar._verb_dicts = {};
            var $qoolbar = $('<div>', {'class': 'qoolbar fade_until_hover'});
            var $qoolbar_head = $('<div>', {
                'class': 'qoolbar-head qool-more-expanse',
                'title': "This is your qoolbar. Drag these verbs onto the page."
            }).text("qoolbar");
            var $qoolbar_body = $('<div>', {'class': 'qoolbar-body'});
            $qoolbar.append($qoolbar_head);
            $qoolbar.append($qoolbar_body);
            var num_verbs = verbs.length;
            for (var i_verb=0 ; i_verb < num_verbs ; i_verb++) {
                // THANKS:  (avoiding for-in loop on arrays) http://stackoverflow.com/a/3010848/673991
                var verb = verbs[i_verb];
                qoolbar._verb_dicts[verb.idn] = verb;
                var tool_classes = 'qool-verb qool-verb-' + verb.name;
                if (verb.qool_num === 0) {
                    tool_classes += ' ' + 'verb-deleted';
                }
                var $verb_tool = $('<div>', {
                    'class': tool_classes,
                    'data-verb': verb.name,
                    'data-vrb-idn': verb.idn
                });
                $verb_tool.append(verb_icon(verb));
                var $verb_delete = $('<span>', {
                    'class': 'verb-deletion hide_until_more',
                    'title': "remove '" + verb.name + "' from your qoolbar"
                }).text(UNICODE_TIMES);
                $verb_tool.prepend($verb_delete);
                $qoolbar_body.append($verb_tool);
            }
            // noinspection RequiredAttributes
            $qoolbar_body.append(
                $('<div>', {
                    'class': 'qool-more-switch',
                    'title': "more options"
                }).html(
                    "&vellip;"
                )
            );
            $qoolbar_body.append(
                $('<div>', {
                    'class': 'qool-more-foot qool-more-expanse',
                    'title': "Enter a name for a new verb."
                }).append(
                    $('<input>', {
                        id: 'qool-new-verb',
                        type: 'text',
                        placeholder: "new verb"
                    })
                )
            );
            qool_more_toggle(false);
            // console.log('_verb_dicts', qoolbar._verb_dicts)
            // EXAMPLE: _verb_dicts {
            //      0q82_86: {qool_num: 1, icon_url: "http://.../thumbsup_16.png", name: "like", idn: "0q82_86"}
            //      0q82_89: {qool_num: 1, icon_url: "http://.../delete_16.png", name: "delete", idn: "0q82_89"}
            //      0q83_01FC: {qool_num: 0, icon_url: "data:image/png;base64,iVB...mCC", name: "laugh", idn: "0q83_01FC"}
            //      0q83_0301: {qool_num: 1, icon_url: "data:image/png;base64,iVB...g==", name: "spam", idn: "0q83_0301"}
            //      0q83_0335: {qool_num: 1, icon_url: "data:image/png;base64,iVB...II=", name: "laugh", idn: "0q83_0335"}
            // }
            return $qoolbar;
        }

        /**
         * Decorate qiki-word-associated elements with their verbs and scores.
         *
         * Requirements before calling:
         *     - The elements are expected to already have attributes.
         *           - data-idn - idn qstring of the associated word
         *           - data-jbo - JSON of array of qoolifying verbs (jQuery .data() makes it an object)
         *     - qoolbar.html() has finished (its built_callback was called),
         *       indicating the qoolbar elements have been constructed and
         *       and qoolbar._verb_dicts[] is populated.
         *
         * data-jbo e.g.
         * [
         *     {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q83_0188"},
         *     {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 2, "idn": "0q83_01CD"},
         *     {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 3, "idn": "0q83_01D1"},
         *     {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 4, "idn": "0q83_01FA"}
         * ]
         *
         * Append the qoolbar icons that have been applied to them, based on their data-jbo.
         * @param selector
         */
        qoolbar.bling = function qoolbar_bling(selector) {
            $(selector).each(function () {
                var $element = $(this);
                var jbo = $element.data('jbo');
                if (typeof jbo === 'string') {
                    console.error("data-jbo not converted, still a string:'" + jbo + "'");
                    jbo = JSON.parse(jbo);
                }
                console.assert(typeof jbo === 'object', typeof jbo, jbo);
                var scores = scorer(jbo);
                var verb_widgets = [];
                for (var vrb in scores) {
                    if (scores.hasOwnProperty(vrb)) {
                        var score = scores[vrb];
                        if (qoolbar._verb_dicts.hasOwnProperty(vrb)) {
                            var verb_dict = qoolbar._verb_dicts[vrb];
                            // console.log("bling", vrb, verb_dict);
                            // EXAMPLE:  0q82_86 {idn: "0q82_86", icon_url: "http://tool.qiki.info/icon/thumbsup_16.png", name: "like"}
                            var $verb_icon = verb_icon(verb_dict);
                            safe_set_attr(
                                $verb_icon,
                                'title',
                                verb_dict.name + ": " + score.history.join("-")
                            );
                            var $my_score = $('<span>')
                                .addClass('icon-sup')
                                .text(str(score.my));
                            var $everybody_score = $('<span>', {
                                'class': 'icon-sub'
                            }).text(score.sum.toString());
                            var $icon_bling = $('<span>')
                                .addClass('icon-bling')
                                .append($my_score)
                                .append($everybody_score);
                            var $verb = $('<span>')
                                .addClass('qool-icon')
                                .data('num', score.my)   // Never shows up as data-num attribute, unfortunately.
                                .data('vrb-idn', vrb)
                                .append($verb_icon)
                                .append($icon_bling);
                            verb_widgets.push($verb);
                            if (score.my !== 0) {
                                // TODO:  Resolve whether to do this with deleted verbs.
                                //        E.g. if a user deletes the delete verb (red x),
                                //        Should his up-to-then deleted objects remain deleted forever?
                                //        Or should his notion of deletion itself be deleted,
                                //        thereby mass-undeleting??  Prolly not that...

                                // TODO:  If "deleted" is unchecked, I need to hide both
                                //        - what the viewer has deleted
                                //        - what the AUTHOR has deleted
                                //        but ignore any deletions by non-authors (who are not me)
                                //        this calls out for a bot!
                                //        Maybe I should NEVER show author deletions to non-authors,
                                //        even when the box IS checked.
                                var data_name_me = 'data-qool-' + verb_dict.name + '-me';
                                // $element.attr(data_name_me, score.my);
                                safe_set_attr($element, data_name_me, score.my)
                            }
                            var score_they = score.sum - score.my;
                            if (score_they !== 0) {
                                var data_name_they = 'data-qool-' + verb_dict.name + '-they';
                                // $element.attr(data_name_they, score_they);
                                safe_set_attr($element, data_name_they, score_they);
                            }
                        } else {
                            console.warn("Verb", vrb, "not in qoolbar");
                        }
                    }
                }
                var $bling = $('<span>', {'class': 'qool-bling'});
                $bling.append(verb_widgets);
                $element.children('.qool-bling').remove();   // remove old bling
                $element.append($bling)
            });
        };

        function safe_set_attr(element, attr_name, attr_value) {
            // TODO:  Test and use for attr GETTING too.
            var return_value = null;
            try {
                return_value = $(element).attr(attr_name, attr_value);
            } catch (e) {
                try {
                    return_value = $(element).attr(attr_name, "(error)");
                    console.warn(
                        ".attr() can't set",
                        attr_name.toString(),
                        "to",
                        attr_value.toString(),
                        "because:\n",
                        e.message
                    );
                } catch (ee) {
                    try {
                        console.warn(
                            ".attr() cannot set",
                            attr_name.toString(),
                            "at all, because:\n",
                            ee.message
                        );
                    } catch (eee) {
                        console.error(".attr() meltdown, type", typeof attr_name, eee.message);
                    }
                }
            }
            return return_value;
        }

        /**
         * Get the list of qool verbs from the lex.  Build the qoolbar and stick them in there.
         *
         * Should be called from application inside $(document).ready(function() { ... });
         *
         * @param selector - empty div wherein to place it.
         * @param built_callback -  _verb_dicts are ready.  Time to qoolbar.bling the qool targets.
         */
        qoolbar.html = function qoolbar_html(selector, built_callback) {
            qoolbar.post(
                'qoolbar_list',
                {},
                /**
                 * @param response
                 * @param response.is_valid -- true or false
                 * @param response.verbs -- (if is_valid) -- qool verbs, see qoolbar_build()
                 * @param response.error_message -- (if not is_valid)
                 */
                function qoolbar_list_done(response) {
                    if (response.is_valid) {
                        $(selector).append(qoolbar_build(response.verbs));
                        //noinspection JSUnusedGlobalSymbols,JSValidateTypes
                        $(selector + ' .qool-verb').draggable({
                            helper: 'clone',
                            cursor: '-moz-grabbing',
                            // TODO:  grabby cursor?  -webkit-grab?  move?  http://stackoverflow.com/a/26811031/673991
                            scroll: false,
                            appendTo: 'body',
                            // THANKS:  helper-clone on top, https://stackoverflow.com/q/17977799/673991
                            start: function () {
                                association_in_progress();
                            },
                            stop: function () {
                                association_resolved();
                            }
                        });
                        $('.qoolbar')
                            .on('mousedown', '.qool-more-switch', function qool_more_click(event) {
                                qool_more_toggle();
                                event.stopPropagation();   // avoid document click's hiding of qool-more
                                event.preventDefault();
                                // THANKS:  no text select, https://stackoverflow.com/a/43321596/673991
                                //          mousedown preventDefault avoids double-click
                            })
                            .on('mousedown', '.verb-deletion', function verb_delete(event) {
                                var $qool_verb = $(this).closest('.qool-verb');
                                if ($qool_verb.length === 1) {
                                    var verb_idn = $qool_verb.data('vrb-idn');
                                    qoolbar.post(
                                        'delete_verb',
                                        {idn: verb_idn},
                                        function delete_verb_done(response) {
                                            console.debug("delete verb done", response);
                                            // TODO:  Remove from qoolbar._verb_dicts,
                                            //        and maybe qoolbar_build()
                                            //        so we don't have to reload.
                                        }
                                    );
                                } else {
                                    console.error("Delete not inside a qool verb", $(this));
                                }
                                event.stopPropagation();   // avoid document click's hide
                                event.preventDefault();
                            })
                            .on('dragover dragleave', '.qool-verb', function (e) {
                                e.stopPropagation();
                                e.preventDefault();
                            })
                            .on('drop', '.qool-verb', function drop_onto_qoolbar_verb(e) {
                                e.stopPropagation();
                                e.preventDefault();
                                var qool_verb_name = $(this).data('verb');
                                var qool_verb_idn = $(this).data('vrb-idn');
                                var files = e.originalEvent.target.files || e.originalEvent.dataTransfer.files;
                                if (files.length >= 1) {
                                    var f = files[0];
                                    console.log("Drop", qool_verb_name, qool_verb_idn, files.length, "files", f.type, f.size);
                                    if (f.size <= qoolbar.MAX_DROP_FILE_SIZE) {
                                        var reader = new FileReader();
                                        /**
                                         * Read icon image file.
                                         *
                                         * @param file_event
                                         * @param file_event.target
                                         * @param file_event.target.result
                                         * @param file_event.target.result[]
                                         *
                                         * @property reader
                                         * @property reader.result
                                         * @property reader.result[]
                                         */
                                        reader.onload = function (file_event) {
                                            console.log("dropped", file_event.target.result.length, "bytes", file_event.target.result);
                                            console.log("dropped", reader.result.length, "bytes", reader.result);
                                            // TODO:  Convert reader.result to data:image
                                            var data_image = data_image_from(reader.result, files[0].type);
                                            post_icon(qool_verb_idn, data_image);
                                        };
                                        reader.readAsBinaryString(f);
                                    } else {
                                        console.warn(
                                            "File is",
                                            f.size,
                                            "bytes, it should be less than",
                                            qoolbar.MAX_DROP_FILE_SIZE
                                        );
                                    }
                                } else {
                                    var dropped_html = e.originalEvent.dataTransfer.getData("text/html");
                                    var $dropped_container = $('<div>').append(dropped_html);
                                    // FIXME:  security concerns
                                    var image_url = $dropped_container.find("img").attr('src');
                                    console.log("dropped url", image_url, dropped_html);
                                    // EXAMPLE:  data:image/png
                                    //     data:image/png;base64,iVBORw0KGgo ... ggg==
                                    //     <img class="irc_mut" alt="Image result for laughing emoji" onload="..."
                                    //          src="data:image/png;base64,iVB... gg==" width="16" height="16"
                                    //          style="margin-top: 169px;">
                                    // EXAMPLE:  https
                                    //     https://lh4.googleusercontent.com/proxy/pBKC ... -no-nu
                                    //     <img class="irc_mi" src="https://lh4.googleusercontent.com/proxy/pBKC ... -no-nu"
                                    //          onload="..." width="16" height="16" style="margin-top: 169px;"
                                    //          alt="Image result for laughing emoji">

                                    post_icon(qool_verb_idn, image_url);

                                }
                            })
                        ;
                        if (typeof built_callback === 'function') {
                            built_callback();
                        }
                    } else {
                        console.error("qoolbar_list ajax", response.error_message);
                    }
                },
                function (error_message) {
                    console.error("qoolbar_list post", error_message);
                }
            );
        };

        /**
         * Iconify:  associate an icon URL with a verb.
         *
         * @param qool_verb_idn - the qstring of the idn of the word defining the verb
         * @param image_url - e.g. http://... or data:image/png;base65,...
         * @private
         */
        function post_icon(qool_verb_idn, image_url) {
            qoolbar.post(
                'sentence',
                {
                    vrb_txt: 'iconify',
                    obj_idn: qool_verb_idn,
                    txt: image_url,
                    use_already: true   // Use an old sentence if same txt and num.
                },
                /**
                 * @param response
                 * @param response.is_valid -- all good?
                 * @param response.new_words -- (if valid) json array of words to add to data-jbo.
                 * @param response.error_message (if not valid)
                 */
                function iconify_done(response) {
                    if (response.is_valid) {
                        var new_word = JSON.parse(response.new_words)[0];
                        console.log("Yay iconify", new_word.idn);
                        // TODO:  re-bling all words that use qool_verb_idn, or something
                    } else {
                        console.error("post_icon", response.error_message);
                    }
                }
            );
        }

        /**
         * Convert image to data:image URL.
         *
         * @param bytes - raw contents of the image
         * @param mime_type - e.g. 'image/png'
         * @return {string}
         * @private
         */
        function data_image_from(bytes, mime_type) {
            var base64 = btoa(bytes);
            return (
                'data:' +
                mime_type +
                ';base64,' +
                base64
            );
        }

        /**
         * Identify qoolbar drop-targets.
         *
         * If someone drops a qool verb on them in the future, they will become the object of a new qool sentence.
         *
         * qoolbar.bling() - show past sentences
         * qoolbar.target() - prepare for future sentences
         *
         * May be called right after calling qoolbar.html().  (No need to wait for its callback.)
         *
         * @param selector - e.g. ".word" - all elements must have a data-idn attribute already.
         */
        qoolbar.target = function qoolbar_target(selector) {
            var $objects = $(selector);
            var objects_without_idn = $objects.filter(':not([data-idn])');
            if (objects_without_idn.length > 0) {
                console.error(
                    "Drop objects need a data-idn attribute. " +
                    objects_without_idn.length + " out of " +
                    $objects.length + " are missing one."
                );
            }
            //noinspection JSUnusedGlobalSymbols
            $objects.droppable({
                accept: ".qool-verb",
                hoverClass: 'drop-hover',
                drop: function qool_verb_drop(event, ui) {
                    var $source = ui.draggable;
                    var $destination = $(event.target);
                    var vrb_idn = $source.data('vrb-idn');
                    var destination_idn = $destination.data('idn');
                    qoolbar.post(
                        'sentence',
                        {
                            // vrb_txt: verb_name,   No, this may get a different verb by the same name.  Use idn.
                            // NOTE:  This solved a long-fought bug with multiple laugh verbs.
                            //        The new one was in the qoolbar, but lex['laugh'] got the old one.
                            vrb_idn: vrb_idn,
                            obj_idn: destination_idn,
                            num_add: '1',
                            txt: ''
                        },
                        /**
                         * @param response
                         * @param response.is_valid -- all good?
                         * @param response.icon_html -- (if valid) replacement icon diagram html
                         * @param response.jbo -- (if valid) replacement json for word data-jbo.
                         * @param response.error_message (if not valid)
                         */
                        function qool_verb_drop_done(response) {
                            if (response.is_valid) {
                                valid_sentence_response(response, vrb_idn, $destination);
                            } else {
                                console.error("qool verb drop", response.error_message);
                            }
                        }
                    );
                }
            });
        };

        /**
         * Arrange so that clicking on bling allows you to edit your rating.
         * 
         * @param selector - things with bling
         */
        qoolbar.click_to_edit = function qoolbar_click_to_edit(selector) {

            // TODO:  Can we really rely on $(selector) to contain the $(.qool-icon)s?
            //        Seriously not D.R.Y.
            //        Because that containment is expressed in
            //            word-diagram-call.html
            //            --> icon_diagram
            //            --> playground_extras.py
            //            --> icon-diagram-call.html
            //        Is the solution to develop a REST-full API??
            //        (WTF DOES THIS MEAN? Is this vestigial?)

            //noinspection JSJQueryEfficiency
            $(selector).on('mousedown', '.qool-icon', function bling_mousedown() {
                var was_already_editing = $(this).hasClass('qool-editing');
                $(this).data('was_already_editing', was_already_editing);
            });

            // THANKS:  mousedown before blur, http://stackoverflow.com/a/10653160/673991
            //          then after blur (if any) comes click

            $(selector).on('click', '.qool-icon', function bling_click(event) {
                // TODO:  Shouldn't selector events be bound in qoolbar.target()??
                var $qool_icon = $(this);
                var was_already_editing = $qool_icon.data('was_already_editing');
                $qool_icon.removeData('was_already_editing');
                if (was_already_editing === undefined) {
                    console.warn("Qool icon click without a preceding mousedown?");
                }
                if (!was_already_editing) {
                    $qool_icon.addClass('qool-editing');
                    qoolbar._is_anybody_editing = true;
                    var old_num = $qool_icon.data('num');
                    var $input = $('<input>', {
                        type: 'text',
                        // TODO:  IE7 needs type in definition
                        // SEE:  http://stackoverflow.com/questions/9898442/jquery-create-element-with-attribute-differences
                        'class': 'qool-icon-entry',
                        value: old_num
                    });
                    $qool_icon.find('.icon-bling').append($input);
                    $input.select();
                    var $icon_sup = $qool_icon.find('.icon-sup');
                    var icon_sup_pos = $icon_sup.offset();
                    $input.offset({
                         top:
                             icon_sup_pos.top
                             - $input.outerHeight()
                             + $icon_sup.outerHeight()
                             + qoolbar.ICON_ENTRY_TOP_FUDGE,
                        left:
                            icon_sup_pos.left
                            + qoolbar.ICON_ENTRY_LEFT_FUDGE
                    });
                }
                event.stopPropagation();
            });

            //noinspection JSJQueryEfficiency
            $(selector).on('click', '.qool-icon-entry', function bling_score_click(event) {
                // Clicking the input field itself should not cancel editing.
                // THANKS:  For nested click ignoring, http://stackoverflow.com/a/2364639/673991
                event.stopPropagation();
            });

            //noinspection JSJQueryEfficiency
            $('body').on('keydown', '.qool-icon-entry', 'return', function bling_score_return(event) {
                event.preventDefault();
                var new_num = $(this).val().trim();
                if (new_num === '') {
                    end_all_editing();
                    return
                }
                var $qool_icon = $(this).closest('.qool-icon');
                var vrb_idn = $qool_icon.data('vrb-idn');
                if (typeof vrb_idn !== 'string') {
                    console.error("qool-icon element needs a data-vrb-idn attribute");
                }
                var $destination = $(this).closest(selector);
                var obj_idn = $destination.data('idn');
                // TODO:  Search instead for a class that qoolbar.target() installed?  Better D.R.Y.
                qoolbar.post(
                    'sentence',
                    {
                        vrb_idn: vrb_idn,
                        obj_idn: obj_idn,
                        num: new_num,   // FIXME:  This could be a q-string!  Dangerous??
                        txt: ''   // TODO:  Room for a comment?
                                  //        Ooh, yes, pop up a box for that too!
                                  //        Or just allow it after the number!!!
                                  //        [42 - that's my answer and I'm sticking to it]
                                  //        So it'd be handy if the input box grew as you typed
                                  //        even multiple lines!
                    },
                    function bling_score_change_done(response) {
                        if (response.is_valid) {
                            valid_sentence_response(response, vrb_idn, $destination);
                            end_all_editing();
                            // $qool_icon.replaceWith(response.icon_html);
                        } else {
                            console.warn("Error editing num: " + response.error_message);
                        }
                    }
                );
            });

            //noinspection JSJQueryEfficiency
            $('body').on('keydown', '.qool-icon-entry', 'esc', function bling_score_esc(event) {
                event.preventDefault();
                end_all_editing();
            });

            $(window.document).on('blur', '.qool-icon-entry', function bling_score_blur() {
                // THANKS:  For event on dynamic selector, http://stackoverflow.com/a/1207393/673991
                if (qoolbar) {
                    end_all_editing();
                }
            });
        };
        
        $(window.document).on('click', '.qoolbar', function qoolbar_background_click(event) {
            event.stopPropagation();
        });
        $(window.document).on('click', function document_background_click() {
            qool_more_toggle(false);
        });
        $(window.document).on('keypress', '#qool-new-verb', function new_verb_keypress(event) {
            if (event.keyCode === 13) {
                var verb_name = $(this).val();
                $(this).val("");
                qoolbar.post(
                    'new_verb',
                    {name: verb_name},
                    function new_verb_done(response) {
                        console.debug("new verb done", response);
                        // TODO:  Add to qoolbar._verb_dicts, and maybe call qoolbar_build()
                        //        so we don't have to reload to see the new verb.
                    }
                );
            }
        });

        function qool_more_toggle(do_expand) {
            $('.qoolbar').toggleClass('qool-more-expand', do_expand);
        }

        function valid_sentence_response(response, vrb_idn, $destination) {
            if (response.hasOwnProperty('new_words')) {
                var jbo = $destination.data('jbo');
                console.assert(typeof jbo === 'object', typeof jbo);
                var new_words_array = JSON.parse(response.new_words);
                var jbo_plus_new = jbo.concat(new_words_array);
                $destination.data('jbo', jbo_plus_new);
                qoolbar.bling($destination);
            } else {
                qoolbar.page_reload();
            }
        }
        //
        // function json_concat(ja1, ja2) {
        //     console.assert(typeof ja1 === 'string');
        //     console.assert(typeof ja2 === 'string');
        //     return JSON.stringify($.parseJSON(ja1) + $.parseJSON(ja2));
        // }

        qoolbar.page_reload = function qoolbar_page_reload() {
            // noinspection JSDeprecatedSymbols
            window.location.reload(true);
            // TODO:  Reload Chrome, https://stackoverflow.com/q/10719505/673991
        };

        /**
         *
         * action           variables                response fields (when response.is_valid is true)
         * ------           ---------
         * 'qoolbar_list'   (none)
         * 'new_verb'       name: string
         * 'delete_verb'    idn: q-string
         * 'answer'         question: string
         *                  answer: string
         * 'sentence'       vrb_idn: q-string   \ pick one
         *                  vrb_txt: string     /
         *                  obj_idn: q-string
         *                  num: number       \ pick one
         *                  num_add: number   / (default 1)
         *                  txt: string (default "")
         *                  use_already: bool (default false)   Use an old sentence if same s,v,o,t,n.
         *
         * @param {string} action      \ see table
         * @param {object} variables   / above
         * @param {function} callback_done(response)
         *                   response.is_valid {boolean}
         *                   response.error_message (when is_valid is false)
         *                   response.<other_stuff> (when is_valid is true)
         * @param {function=} callback_fail (optional)
         */
        qoolbar.post = function qoolbar_post(action, variables, callback_done, callback_fail) {
            var fail_function;
            if (typeof callback_fail === 'undefined') {
                fail_function = function (error_message) {
                    console.error("_post", action, error_message);
                };
            } else {
                fail_function = callback_fail;
            }
            variables.action = action;
            variables.csrfmiddlewaretoken = $.cookie('csrftoken');
            $.post(
                qoolbar._ajax_url,
                variables
            ).done(function post_done(response_body) {
                var response_object = JSON.parse(response_body);
                response_object.original_json = response_body;
                callback_done(response_object);
            }).fail(function post_fail(jqXHR) {
                fail_function(jqXHR.responseText);
            });
        };

        /**
         * Construct a DOM icon for the verb.
         *
         * @param verb -- associative array of the verb
         * @param verb.name -- e.g. 'like'
         * @param verb.icon_url -- from the latest iconify sentence, or null if there isn't any
         * @return {jQuery}
         * @private
         */
        function verb_icon(verb) {
            var $verb_icon;
            if (verb.icon_url === null) {
                var cap_first_letter = verb.name.charAt(0).toUpperCase();
                $verb_icon = $('<div>', {'class': 'letter-icon', title: verb.name}).text(cap_first_letter);
            } else {
                // noinspection RequiredAttributes, HtmlRequiredAltAttribute
                $verb_icon = $('<img>', {src: verb.icon_url, title: verb.name});
            }
            return $verb_icon;
        }

        qoolbar.i_am = function qoolbar_i_am(me_idn) {
            qoolbar._me_idn = me_idn;
        };

        function str(x) {
            if (x == null) {
                return ''
            } else {
                return x.toString()
            }
        }

        /**
         * Tally scores for a word, from its qoolifying words.
         *
         * @param jbo -- array of qoolifying words (properties idn, sbj, vrb, txt, num)
         * @return {{}} -- associative object whose properties (keys) are verb qstrings (e.g. '0q82_25')
         *      and whose values are objects with these properties associated with that verb:
         *          sum -- sum of each user's latest num
         *          my -- latest num from the current user, identified by qoolbar.i_am()
         *          history -- array of nums in qoolifying words (ignoring user)
         *              TODO:  Associate nums with each user.  Requires authentication.
         * @property word
         * @property word.sbj
         * @property word.vrb
         */
        function scorer(jbo) {
            var scores = {};
            var jbo_dict = {};   // 2D array of scores, indexed by verb idn, then subject idn
            console.assert(typeof jbo === 'object', "Cannot score a " + typeof jbo);
            $.each(jbo, function (_, word) {
                if (!(word.vrb in scores)) {
                    scores[word.vrb] = {'sum': 0, 'my': null, 'history': []};
                }
                if (!(word.vrb in jbo_dict)) {
                    jbo_dict[word.vrb] = {}
                }
                jbo_dict[word.vrb][word.sbj] = {'num': word.num};
                scores[word.vrb].history.push(word.num)
            });
            for (var vrb in jbo_dict) {
                // Icons will appear in chronological order, if browser cooperates.
                if (jbo_dict.hasOwnProperty(vrb)) {
                    for (var sbj in jbo_dict[vrb]) {
                        if (jbo_dict[vrb].hasOwnProperty(sbj)) {
                            var author_entry = jbo_dict[vrb][sbj];
                            if (qoolbar._me_idn === sbj) {
                                scores[vrb].my = author_entry.num;
                            }
                            scores[vrb].sum += author_entry.num;
                        }
                    }
                }
            }
            return scores;
        }

        function association_in_progress() {   // indicating either (1) nouns are selected,
                                                                        // or (2) a verb is dragging
            $(window.document.body).addClass('target-in-progress');
        }

        function association_resolved() {   // indicating normalcy
            $(window.document.body).removeClass('target-in-progress');
        }

        qoolbar._is_anybody_editing = false;

         function end_all_editing() {
            if (qoolbar._is_anybody_editing) {
                qoolbar._is_anybody_editing = false;
                // TODO:  _is_anybody_editing -- is this now obviated?
                //        This _is_anybody_editing flag presumably makes end_all_editing() less of a drag.
                //        Otherwise there might be frequent expensive jQuery removing.
                //        But that's when it used to be called every document click.
                //        Now with a saner on-blur dynamically filtered by .qool-icon-entry,
                //        it would get called a lot less often.
                //        So it's possible end_all_editing() should be shortened
                //        to just the two remove calls.
                //        Sheesh yes, I think this flag is always true when this function is called!
                $('.qool-editing').removeClass('qool-editing');
                $('.qool-icon-entry').remove();
            }
        }

        qoolbar.is_ready = true;
    });
}(window, window.qoolbar = window.qoolbar || {}, window.jQuery));
// THANKS:  http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
// THANKS:  http://appendto.com/2010/10/how-good-c-habits-can-encourage-bad-javascript-habits-part-1/
