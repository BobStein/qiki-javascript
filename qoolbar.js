// qoolbar.js - a menu of qiki verb icons to apply to things on a web page.
'use strict';

(function(qoolbar, $) {
    if (typeof $ !== 'function') {
        console.error("The qoolbar.js module requires jQuery.")
    } else if (typeof $.ui === 'undefined') {
        console.error("The qoolbar.js module requires jQuery UI.")
    }

    qoolbar._ajax_url = null;
    qoolbar.ajax_url = function(url) {
        qoolbar._ajax_url = url;
    };

    qoolbar.html = function(selector, built_callback) {
        qoolbar.post(
            'qoolbar_list',
            {},
            /**
             * @param response
             * @param response.is_valid -- true or false
             * @param response.verbs -- (if is_valid) -- qool verbs, see qoolbar._build()
             * @param response.error_message -- (if not is_valid)
             */
            function(response) {
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
                            //$(ui.helper).addClass('dragging');
                        },
                        stop: function () {
                            qoolbar._associationResolved();
                        }
                    });
                    $('.qoolbar').on('click', '.qool-more', function () {
                        console.debug('new verb');
                        $('.qool-more-expanse').toggleClass('qool-more-hide');
                    });
                    if (typeof built_callback === 'function') {
                        built_callback();
                    }
                } else {
                    console.error(response.error_message);
                    alert(response.error_message);
                }
            },
            function(error_message) {
                console.error(error_message);
            }
        );
    };

    qoolbar.target = function(selector) {
        // Identify the elements that, if we drop a qool icon on them, become the object of a new qool sentence.
        // Each must have a data-idn attribute.
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
            drop: function(event, ui) {
                var $source = ui.draggable;
                var $destination = $(event.target);
                var verb_name = $source.data('verb');
                var vrb_idn = $source.data('vrb-idn');
                var destination_idn = $destination.data('idn');
                qoolbar.post(
                    'sentence',
                    {
                        vrb_txt: verb_name,
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
                    function(response) {
                        if (response.is_valid) {
                            _valid_sentence_response(response, vrb_idn, $destination);
                        } else {
                            alert(response.error_message);
                        }
                    }
                );
            }
        });
    };

    function _valid_sentence_response(response, vrb_idn, $destination) {
        var $qool_icon = $destination.find('.qool-icon').filter('[data-vrb-idn="' + vrb_idn + '"]');
        if (response.hasOwnProperty('icon_html')) {
            //console.info(response.icon_html);
            if ($qool_icon.length > 0) {
                $qool_icon.replaceWith(response.icon_html)
            } else {
                $destination.find('.qool-bling').append(response.icon_html)
            }
        } else if (response.hasOwnProperty('jbo')) {
            var new_jbos = $.parseJSON(response.jbo);
            var new_jbo = new_jbos[0];
            $destination.data('jbo').push(new_jbo);
            //console.info($destination.data('jbo'));
            qoolbar.bling($destination);
        } else {
            window.location.reload(true);
        }
    }

    qoolbar.post = function(action, variables, callback_done, callback_fail) {
        var fail_function;
        if (typeof callback_fail === 'undefined') {
            fail_function = qoolbar._default_fail_callback;
        } else {
            fail_function = callback_fail;
        }
        variables.action = action;
        variables.csrfmiddlewaretoken = $.cookie('csrftoken');
        $.post(qoolbar._ajax_url, variables).done(function(response_body) {
            var response_object = $.parseJSON(response_body);
            response_object.original_json = response_body;
            callback_done(response_object);
        }).fail(function(jqXHR) {
            fail_function(jqXHR.responseText);
        });
    };

    qoolbar._default_fail_callback = function(error_message) {
        alert(error_message);
    };

    /**
     * Build the qoolbar div, with verb spans.
     *
     * @param verbs[]
     * @param verbs.length
     * @param verbs.name -- e.g. 'like'
     * @param verbs.idn
     * @param verbs.icon_url -- from the iconify sentence
     * @returns {*|HTMLElement}
     * @private
     */
    // Why does verbs.name work and not verbs[].name?
    // SEE:  http://usejsdoc.org/tags-param.html#parameters-with-properties
    qoolbar._build = function(verbs) {
        qoolbar._verb_dicts = {};
        var $div = $('<div>', {class: 'qoolbar fade_until_hover'});
        var num_verbs = verbs.length;
        for (var i_verb=0 ; i_verb < num_verbs ; i_verb++) {
            // THANKS:  (avoiding for-in loop on arrays) http://stackoverflow.com/a/3010848/673991
            var verb = verbs[i_verb];
            qoolbar._verb_dicts[verb.idn] = verb;
            // noinspection RequiredAttributes
            var $verb_icon = $('<img>', {src: verb.icon_url, title: verb.name});
            var verb_html = $('<span>')
                .html($verb_icon)
                .addClass('qool-verb qool-verb-' + verb.name)
                .attr('data-verb', verb.name)
                .attr('data-vrb-idn', verb.idn);
            $div.append(verb_html);
        }
        // noinspection RequiredAttributes
        $div.append(
            $('<span>', {
                class: 'qool-more'
            }).append(
                $('<img>', {
                    src: '/meta/static/image/icon-plus.png',
                    title: 'more...'
                })
            )
        );
        $div.append(
            $('<span>', {
                class: 'qool-more-expanse qool-more-hide'
            }).append(
                $('<input>', {
                    id: 'qool-new-verb',
                    type: 'text',
                    placeholder: "new verb"
                })
            )
        );
        return $div;
    };

    qoolbar.i_am = function(me_idn) {
        qoolbar._me_idn = me_idn;
    };

    /**
     * Decorate words with the qoolbar icons that have been applied to them,
     * based on their data-jbo.
     * @param selector
     */
    qoolbar.bling = function(selector) {
        $(selector).each(function() {
            var jbo = $(this).data('jbo');
            var scores = _scorer(jbo);
            var verb_widgets = [];
            for (var vrb in scores) {
                if (scores.hasOwnProperty(vrb)) {
                    var score = scores[vrb];
                    var verb_dict = qoolbar._verb_dicts[vrb];
                    // noinspection RequiredAttributes
                    var $verb_icon = $('<img>', {
                        src: verb_dict.icon_url,
                        title: verb_dict.name + ": " + score.history.join("-")
                    });
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
                }
            }

            //for (var idn in jbo) {
            //    var word = jbo[idn];
            //    var verb_idn = word.vrb;
            //    var verb_dict = qoolbar._verb_dicts[verb_idn]
            //    var $verb_icon = $('<img>')
            //        .attr('src', verb_dict.icon_url)
            //        .attr('title', verb_dict.name);
            //    var icon = $('<span>')
            //        .html($verb_icon)
            //        .addClass('qool-icon');
            //    verb_widgets.push(icon);
            //}

            var bling = $('<span>')
                .addClass('qool-bling');
            bling.append(verb_widgets);
            $(this).children('.qool-bling').remove();
            $(this).append(bling)
        });
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
     * @param jbo -- array of qoolifying words (properties idn, sbj, vrb, txt, num)
     * @returns {{}} -- associative object whose properties are verb qstrings (e.g. '0q82_25')
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
        $.each(jbo, function(_, word) {
        //for (var i in jbo) {
        //    var word = jbo[i];
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

    qoolbar._associationInProgress = function() {   // indicating either (1) nouns are selected,
                                                                   // or (2) a verb is dragging
        $(document.body).css('background-color', 'rgb(200,200,200)');
    };

    qoolbar._associationResolved = function() {   // indicating normalcy
        $(document.body).css('background-color', 'rgb(215,215,215)');
    };

    qoolbar.click_to_edit = function() {

        // TODO:  Can we really rely on $(.word) to contain the $(.qool-icon)s?  Seriously not D.R.Y.
        // Because that containment is expressed in word-diagram-call.html --> icon_diagram --> playground_extras.py --> icon-diagram-call.html
        // Is the solution to develop a REST-full API??

        //noinspection JSJQueryEfficiency
        $('.word').on('mousedown', '.qool-icon', function () {
            var was_already_editing = $(this).hasClass('qool-editing');
            $(this).data('was_already_editing', was_already_editing);
        });

        // Blur, if it happens, will come between mousedown and click events.
        // THANKS:  http://stackoverflow.com/a/10653160/673991

        //noinspection JSJQueryEfficiency
        $('.word').on('click', '.qool-icon', function (event) {
            // TODO:  Shouldn't .word events be bound in qoolbar.bling()?
            var was_already_editing = $(this).data('was_already_editing');
            $(this).removeData('was_already_editing');
            if (was_already_editing === undefined) {
                console.warn("Qool icon click without a preceding mousedown?");
            }
            if (!was_already_editing) {
                $(this).addClass('qool-editing');
                qoolbar._is_anybody_editing = true;
                var old_num = $(this).data('num');
                var $input = $('<input>', {
                    type: 'text',
                    // TODO:  IE7 needs type in definition
                    // SEE:  http://stackoverflow.com/questions/9898442/jquery-create-element-with-attribute-differences
                    class: 'qool-icon-entry',
                    value: old_num
                });
                var $span_input = $('<span>', {
                    class: 'qool-icon-entry-container'
                });
                $span_input.append($input);
                $(this).append($span_input);
                $input.select();
                var $icon_sup = $(this).find('.icon-sup');
                var icon_sup_pos = $icon_sup.offset();
                $input.offset({
                     'top': icon_sup_pos.top - $input.outerHeight() + $icon_sup.outerHeight(),
                    'left': icon_sup_pos.left
                });
            }
            event.stopPropagation();
        });

        //noinspection JSJQueryEfficiency
        $('.word').on('click', '.qool-icon-entry', function (event) {
            // Clicking the input field itself should not cancel editing.
            // THANKS:  For nested click ignoring, http://stackoverflow.com/a/2364639/673991
            event.stopPropagation();
        });

        //noinspection JSJQueryEfficiency
        $('body').on('keydown', '.qool-icon-entry', 'return', function(event) {
            event.preventDefault();
            var new_num = $(this).val();
            if (new_num === '') {
                qoolbar._end_all_editing();
                return
            }
            var $qool_icon = $(this).closest('.qool-icon');
            var vrb_idn = $qool_icon.data('vrb-idn');
            if (typeof vrb_idn !== 'string') {
                console.error("qool-icon element needs a data-vrb-idn attribute");
            }
            var $destination = $(this).closest('.word');
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
                function(response) {
                    if (response.is_valid) {
                        _valid_sentence_response(response, vrb_idn, $destination);
                        // console.info("Just in: " + response.icon_html);
                        qoolbar._end_all_editing();
                        console.debug("HACK " + response.jbo);
                        $qool_icon.replaceWith(response.icon_html);
                    } else {
                        console.warn("Error editing num: " + response.error_message);
                    }
                }
            );
        });

        //noinspection JSJQueryEfficiency
        $('body').on('keydown', '.qool-icon-entry', 'esc', function(event) {
            event.preventDefault();
            qoolbar._end_all_editing();
        });

        $(document).on('blur', '.qool-icon-entry', function() {
            // THANKS:  For event on dynamic selector, http://stackoverflow.com/a/1207393/673991
            if (qoolbar) {
                qoolbar._end_all_editing();
            }
        });
    };

    //qoolbar._qool_icon_entry_keypress = function() {
    //};

    qoolbar._is_anybody_editing = false;

    qoolbar._end_all_editing = function() {
        if (qoolbar._is_anybody_editing) {
            qoolbar._is_anybody_editing = false;
            // TODO:  _is_anybody_editing obviated?
            // This _is_anybody_editing flag presumably makes _end_all_editing() less of a drag.
            // Otherwise there might be frequent expensive jQuery removing.
            // But that's when it used to be called every document click.
            // Now with a saner on-blur dynamically filtered by .qool-icon-entry,
            // it would get called a lot less often.
            // So it's possible _end_all_editing() should be shortened
            // to just the two remove calls.
            // Sheesh yes, I think this flag is always true when this function is called!
            $('.qool-editing').removeClass('qool-editing');
            $('.qool-icon-entry-container').remove();
        }
    };

}(window.qoolbar = window.qoolbar || {}, window.jQuery));
// THANKS:  http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
// THANKS:  http://appendto.com/2010/10/how-good-c-habits-can-encourage-bad-javascript-habits-part-1/
