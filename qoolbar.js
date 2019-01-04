// qoolbar.js - a menu of qiki verb icons to apply to things on a web page.
'use strict';

(function (qoolbar, $) {
    if (typeof $ !== 'function') {
        console.error("The qoolbar.js module requires jQuery.");
    } else if (typeof $.ui === 'undefined') {
        console.error("The qoolbar.js module requires jQuery UI.");
    }

    qoolbar.MAX_DROP_FILE_SIZE = 1000;
    qoolbar._ajax_url = null;
    qoolbar.ajax_url = function (url) {
        qoolbar._ajax_url = url;
    };
    qoolbar.ICON_ENTRY_TOP_FUDGE = -3;   // Correspond to bottom padding and margin
    qoolbar.ICON_ENTRY_LEFT_FUDGE = 1;   // Correspond to left padding and margin
    var UNICODE_TIMES = '\u00D7';   // aka &times;

    /**
     * Generate the qoolbar.  Typically called from $(document).ready(function() { ... });
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
             * @param response.verbs -- (if is_valid) -- qool verbs, see qoolbar._build()
             * @param response.error_message -- (if not is_valid)
             */
            function (response) {
                if (response.is_valid) {
                    $(selector).append(qoolbar._build(response.verbs));
                    //noinspection JSUnusedGlobalSymbols,JSValidateTypes
                    $(selector + ' .qool-verb').draggable({
                        helper: 'clone',
                        cursor: '-moz-grabbing',
                        // TODO:  grabby cursor?  -webkit-grab?  move?  http://stackoverflow.com/a/26811031/673991
                        scroll: false,
                        start: function () {
                            qoolbar._associationInProgress();
                        },
                        stop: function () {
                            qoolbar._associationResolved();
                        }
                    });
                    $('.qoolbar')
                        .on('mousedown', '.qool-more-switch', function qool_more_click(event) {
                            _qool_more_toggle();
                            event.stopPropagation();   // avoid document click's hide
                            event.preventDefault();
                            // THANKS:  no text select, https://stackoverflow.com/a/43321596/673991
                            //          mousedown-preventDefault avoids double-click
                        })
                        .on('mousedown', '.verb-deletion', function verb_delete(event) {
                            var $qool_verb = $(this).closest('.qool-verb');
                            if ($qool_verb.length === 1) {
                                var verb_name = $qool_verb.data('verb');
                                var verb_idn = $qool_verb.data('vrb-idn');
                                console.debug("Deletion", verb_name, verb_idn);
                                qoolbar.post(
                                    'delete_verb',
                                    {idn: verb_idn},
                                    function delete_verb_done(response) {
                                        console.debug("delete verb done", response);
                                        // TODO:  Remove from qoolbar._verb_dicts, and maybe qoolbar._build()
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
                                        var data_image = _data_image_from(reader.result, files[0].type);
                                        _post_icon(qool_verb_idn, data_image);
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

                                _post_icon(qool_verb_idn, image_url);

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
    function _post_icon(qool_verb_idn, image_url) {
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
            function (response) {
                if (response.is_valid) {
                    var new_word = $.parseJSON(response.new_words)[0];
                    console.log("Yay iconify", new_word.idn);
                } else {
                    console.error("_post_icon", response.error_message);
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
    function _data_image_from(bytes, mime_type) {
        var base64 = btoa(bytes);
        console.log("data image", bytes.length, base64.length);
        return (
            'data:' +
            mime_type +
            ';base64,' +
            base64
        );
    }

    /**
     * Decorate word-associated elements with the verbs and scores they've received in the past.
     *
     * Requirements before calling:
     *     - The elements are expected to already have data-idn and data-jbo attributes.
     *     - qoolbar.html() has called back, indicating the qoolbar has been built and the qool verbs are known.
     *
     * data-jbo of the selected object is a JSON of it's qool score histories, e.g.
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
            var jbo = $(this).data('jbo');
            var scores = _scorer(jbo);
            var verb_widgets = [];
            for (var vrb in scores) {
                if (scores.hasOwnProperty(vrb)) {
                    var score = scores[vrb];
                    if (qoolbar._verb_dicts.hasOwnProperty(vrb)) {
                        var verb_dict = qoolbar._verb_dicts[vrb];
                        // console.log("bling", vrb, verb_dict);
                        // EXAMPLE:  0q82_86 {idn: "0q82_86", icon_url: "http://tool.qiki.info/icon/thumbsup_16.png", name: "like"}
                        var $verb_icon = _verb_icon(verb_dict);
                        $verb_icon.attr('title', verb_dict.name + ": " + score.history.join("-"));
                        var $my_score = $('<span>')
                            .addClass('icon-sup')
                            .text(_str(score.my));
                        var $everybody_score = $('<span>', {
                            class: 'icon-sub'
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
                    } else {
                        console.warn("Verb", vrb, "not in qoolbar");
                    }
                }
            }
            var $bling = $('<span>', {class: 'qool-bling'});
            $bling.append(verb_widgets);
            $(this).children('.qool-bling').remove();   // remove old bling
            $(this).append($bling)
        });
    };

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
     * @param selector - all elements must have a data-idn attribute.
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
            drop: function (event, ui) {
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
                    function (response) {
                        if (response.is_valid) {
                            _valid_sentence_response(response, vrb_idn, $destination);
                        } else {
                            console.error("qool verb drop", response.error_message);
                        }
                    }
                );
            }
        });
    };

    qoolbar.click_to_edit = function qoolbar_click_to_edit(selector) {

        // TODO:  Can we really rely on $(selector) to contain the $(.qool-icon)s?  Seriously not D.R.Y.
        // Because that containment is expressed in word-diagram-call.html --> icon_diagram --> playground_extras.py --> icon-diagram-call.html
        // Is the solution to develop a REST-full API??

        //noinspection JSJQueryEfficiency
        $(selector).on('mousedown', '.qool-icon', function () {
            var was_already_editing = $(this).hasClass('qool-editing');
            $(this).data('was_already_editing', was_already_editing);
        });

        // Blur, if it happens, will come between mousedown and click events.
        // THANKS:  http://stackoverflow.com/a/10653160/673991

        //noinspection JSJQueryEfficiency
        $(selector).on('click', '.qool-icon', function (event) {
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
                    class: 'qool-icon-entry',
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
        $(selector).on('click', '.qool-icon-entry', function (event) {
            // Clicking the input field itself should not cancel editing.
            // THANKS:  For nested click ignoring, http://stackoverflow.com/a/2364639/673991
            event.stopPropagation();
        });

        //noinspection JSJQueryEfficiency
        $('body').on('keydown', '.qool-icon-entry', 'return', function (event) {
            event.preventDefault();
            var new_num = $(this).val().trim();
            if (new_num === '') {
                qoolbar._end_all_editing();
                return
            }
            var $qool_icon = $(this).closest('.qool-icon');
            var vrb_idn = $qool_icon.data('vrb-idn');
            if (typeof vrb_idn !== 'string') {
                console.error("qool-icon element needs a data-vrb-idn attribute");
            }
            var $destination = $(this).closest(selector);
            var obj_idn = $destination.data('idn');
            console.debug("obj_idn type " + typeof obj_idn);
            // TODO:  Search instead for a class that qoolbar.target() installed?  Better D.R.Y.
            qoolbar.post(
                'sentence',
                {
                    vrb_idn: vrb_idn,
                    obj_idn: obj_idn,
                    num: new_num,   // This could be a q-string!  Dangerous??
                    txt: ''   // TODO:  Room for a comment?
                },
                function (response) {
                    if (response.is_valid) {
                        _valid_sentence_response(response, vrb_idn, $destination);
                        qoolbar._end_all_editing();
                        $qool_icon.replaceWith(response.icon_html);
                    } else {
                        console.warn("Error editing num: " + response.error_message);
                    }
                }
            );
        });

        //noinspection JSJQueryEfficiency
        $('body').on('keydown', '.qool-icon-entry', 'esc', function (event) {
            event.preventDefault();
            qoolbar._end_all_editing();
        });

        $(document).on('blur', '.qool-icon-entry', function () {
            // THANKS:  For event on dynamic selector, http://stackoverflow.com/a/1207393/673991
            if (qoolbar) {
                qoolbar._end_all_editing();
            }
        });
        $(document).on('click', '.qoolbar', function (event) {
            event.stopPropagation();
        });
        $(document).on('click', function () {
            _qool_more_toggle(false);
        });
        $(document).on('keypress', '#qool-new-verb', function (event) {
            if (event.keyCode === 13) {
                var verb_name = $(this).val();
                $(this).val("");
                console.debug(verb_name);
                qoolbar.post(
                    'new_verb',
                    {name: verb_name},
                    function new_verb_done(response) {
                        console.debug("new verb done", response);
                        // TODO:  Add to qoolbar._verb_dicts, and maybe call qoolbar._build()
                        //        so we don't have to reload to see the new verb.
                    }
                );
            }
        });
    };

    /**
     * Build the qoolbar DOM given an array of verb names and icons.
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
    qoolbar._build = function _qoolbar_build(verbs) {
        qoolbar._verb_dicts = {};
        var $div = $('<div>', {class: 'qoolbar fade_until_hover'});
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
                class: tool_classes,
                'data-verb': verb.name,
                'data-vrb-idn': verb.idn
            });
            $verb_tool.append(_verb_icon(verb));
            var $verb_delete = $('<span>', {
                class: 'verb-deletion hide_until_more',
                title: "remove '" + verb.name + "' from your qoolbar"
            }).text(UNICODE_TIMES);
            $verb_tool.prepend($verb_delete);
            $div.append($verb_tool);
        }
        // noinspection RequiredAttributes
        $div.append(
            $('<div>', {
                class: 'qool-more-switch',
                title: "more options"
            }).html(
                "&vellip;"
            )
        );
        $div.append(
            $('<div>', {
                class: 'qool-more-expanse',   // qool-more-hide'
                title: "Enter a name for a new verb."
            }).append(
                $('<input>', {
                    id: 'qool-new-verb',
                    type: 'text',
                    placeholder: "new verb"
                })
            )
        );
        _qool_more_toggle(false);
        console.log('_verb_dicts', qoolbar._verb_dicts);
        return $div;
    };

    function _qool_more_toggle(is_expanded) {
        $('.qoolbar').toggleClass('qool-more-expand', is_expanded);
    }

    function _valid_sentence_response(response, vrb_idn, $destination) {
        var $qool_icon = $destination.find('.qool-icon').filter('[data-vrb-idn="' + vrb_idn + '"]');
        if (response.hasOwnProperty('icon_html')) {
            // TODO:  This clause never happens any more, right??
            if ($qool_icon.length > 0) {
                $qool_icon.replaceWith(response.icon_html)
            } else {
                $destination.find('.qool-bling').append(response.icon_html)
            }
        } else if (response.hasOwnProperty('jbo')) {
            var new_word = $.parseJSON(response.new_words)[0];
            $destination.data('jbo').push(new_word);
            qoolbar.bling($destination);
        } else {
            window.location.reload(true);
        }
    }

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
        $.post(qoolbar._ajax_url, variables).done(function (response_body) {
            var response_object = $.parseJSON(response_body);
            response_object.original_json = response_body;
            callback_done(response_object);
        }).fail(function (jqXHR) {
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
    function _verb_icon(verb) {
        var $verb_icon;
        if (verb.icon_url === null) {
            var cap_first_letter = verb.name.charAt(0).toUpperCase();
            $verb_icon = $('<div>', {class: 'letter-icon', title: verb.name}).text(cap_first_letter);
        } else {
            // noinspection RequiredAttributes, HtmlRequiredAltAttribute
            $verb_icon = $('<img>', {src: verb.icon_url, title: verb.name});
        }
        return $verb_icon;
    }

    qoolbar.i_am = function qoolbar_i_am(me_idn) {
        qoolbar._me_idn = me_idn;
    };

    function _str(x) {
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
    function _scorer(jbo) {
        var scores = {};
        var jbo_dict = {};
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
    // TODO:  Convert other private functions to closures.

    qoolbar._associationInProgress = function () {   // indicating either (1) nouns are selected,
                                                                    // or (2) a verb is dragging
        $(document.body).addClass('target-in-progress');
    };

    qoolbar._associationResolved = function () {   // indicating normalcy
        $(document.body).removeClass('target-in-progress');
    };

    qoolbar._is_anybody_editing = false;

    qoolbar._end_all_editing = function () {
        if (qoolbar._is_anybody_editing) {
            qoolbar._is_anybody_editing = false;
            // TODO:  _is_anybody_editing -- is this now obviated?
            //        This _is_anybody_editing flag presumably makes _end_all_editing() less of a drag.
            //        Otherwise there might be frequent expensive jQuery removing.
            //        But that's when it used to be called every document click.
            //        Now with a saner on-blur dynamically filtered by .qool-icon-entry,
            //        it would get called a lot less often.
            //        So it's possible _end_all_editing() should be shortened
            //        to just the two remove calls.
            //        Sheesh yes, I think this flag is always true when this function is called!
            $('.qool-editing').removeClass('qool-editing');
            $('.qool-icon-entry').remove();
        }
    };

}(window.qoolbar = window.qoolbar || {}, window.jQuery));
// THANKS:  http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
// THANKS:  http://appendto.com/2010/10/how-good-c-habits-can-encourage-bad-javascript-habits-part-1/
