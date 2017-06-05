/**
 * This file is part of Moodle - http://moodle.org/
 *
 * Moodle is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Moodle is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Moodle.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @package   theme_snap
 * @author    Guy Thomas <gthomas@moodlerooms.com>
 * @copyright Copyright (c) 2016 Blackboard Inc.
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Course main functions.
 */
define(
    [
        'jquery',
        'core/ajax',
        'theme_snap/util',
        'theme_snap/ajax_notification'
    ],
    function($, ajax, util, ajaxNotify) {

        /**
         * Module has been completed.
         * @param {jQuery} module
         * @param {string} completionhtml
         */
        var updateModCompletion = function(module, completionhtml) {
            // Update completion tracking icon.
            module.find('.snap-asset-completion-tracking').html(completionhtml);
            $(document).trigger('snapModuleCompletionChange', module);
        };

        /**
         * Listen for manual completion toggle.
         */
        var listenManualCompletion = function() {
            $('.course-content').on('submit', 'form.togglecompletion', function(e) {
                e.preventDefault();
                var form = $(this);

                if (form.hasClass('ajaxing')) {
                    // Request already in progress.
                    return;
                }

                var id = $(form).find('input[name="id"]').val();
                var completionState = $(form).find('input[name="completionstate"]').val();
                var module = $(form).parents('li.snap-asset').first();
                form.addClass('ajaxing');

                ajax.call([
                    {
                        methodname: 'theme_snap_course_module_completion',
                        args: {id: id, completionstate: completionState},
                        done: function(response) {
                            form.removeClass('ajaxing');
                            if (ajaxNotify.ifErrorShowBestMsg(response)) {
                                return;
                            }
                            // Update completion html for this module instance.
                            updateModCompletion(module, response.completionhtml);
                        },
                        fail: function(response) {
                            form.removeClass('ajaxing');
                            ajaxNotify.ifErrorShowBestMsg(response);
                        }
                    }
                ], true, true);

            });
        };

        /**
         * Reveal page module content.
         *
         * @param {jQuery} pageMod
         * @param {string} completionhtml - updated completionhtml
         */
        var revealPageMod = function(pageMod, completionHTML) {
            pageMod.find('.pagemod-content').slideToggle("fast", function() {
                // Animation complete.
                if (pageMod.is('.state-expanded')) {
                    pageMod.attr('aria-expanded', 'true');
                    pageMod.find('.pagemod-content').focus();

                }
                else {
                    pageMod.attr('aria-expanded', 'false');
                    pageMod.focus();
                }

            });

            if (completionHTML) {
                updateModCompletion(pageMod, completionHTML);
            }
        };

        /**
         * Page mod toggle content.
         */
        var listenPageModuleReadMore = function() {
            var pageToggleSelector = ".modtype_page .instancename,.pagemod-readmore,.pagemod-content .snap-action-icon";
            $(document).on("click", pageToggleSelector, function(e) {
                var pageMod = $(this).closest('.modtype_page');
                util.scrollToElement(pageMod);
                var isexpanded = pageMod.hasClass('state-expanded');
                pageMod.toggleClass('state-expanded');

                var readmore = pageMod.find('.pagemod-readmore');

                var pageModContent = pageMod.find('.pagemod-content');
                if (pageModContent.data('content-loaded') == 1) {
                    // Content is already available so reveal it immediately.
                    revealPageMod(pageMod);
                    var readPageUrl = M.cfg.wwwroot + '/theme/snap/rest.php?action=read_page&contextid=' +
                        readmore.data('pagemodcontext');
                    if (!isexpanded) {
                        $.ajax({
                            type: "GET",
                            async: true,
                            url: readPageUrl,
                            success: function(data) {
                                if (ajaxNotify.ifErrorShowBestMsg(data)) {
                                    return;
                                }
                                // Update completion html for this page mod instance.
                                updateModCompletion(pageMod, data.completionhtml);
                            }
                        });
                    }
                } else {
                    if (!isexpanded) {
                        // Content is not available so request it.
                        pageMod.find('.contentafterlink').prepend(
                            '<div class="ajaxstatus alert alert-info">' + M.str.theme_snap.loading + '</div>'
                        );
                        var getPageUrl = M.cfg.wwwroot + '/theme/snap/rest.php?action=get_page&contextid=' +
                            readmore.data('pagemodcontext');
                        $.ajax({
                            type: "GET",
                            async: true,
                            url: getPageUrl,
                            success: function(data) {
                                if (ajaxNotify.ifErrorShowBestMsg(data)) {
                                    return;
                                }
                                pageModContent.prepend(data.html);
                                pageModContent.data('content-loaded', 1);
                                pageMod.find('.contentafterlink .ajaxstatus').remove();
                                revealPageMod(pageMod, data.completionhtml);
                            }
                        });
                    } else {
                        revealPageMod(pageMod);
                    }
                }

                e.preventDefault();
            });
        };

        /**
         * Light box media.
         * @param {str|jQuery} resourcemod
         */
        var lightboxMedia = function(resourcemod) {
            /**
             * Ensure lightbox container exists.
             *
             * @param appendto
             * @param onclose
             * @returns {*|jQuery|HTMLElement}
             */
            var lightbox = function(appendto, onclose) {
                var lbox = $('#snap-light-box');
                if (lbox.length === 0) {
                    $(appendto).append('<div id="snap-light-box" tabindex="-1">' +
                        '<div id="snap-light-box-content"></div>' +
                        '<a id="snap-light-box-close" class="pull-right snap-action-icon snap-icon-close" href="#">' +
                        '<small>Close</small>' +
                        '</a>' +
                        '</div>');
                    $('#snap-light-box-close').click(function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        lightboxclose();
                        if (typeof(onclose) === 'function') {
                            onclose();
                        }
                    });
                    lbox = $('#snap-light-box');
                }
                return lbox;
            };

            /**
             * Close lightbox.
             */
            var lightboxclose = function() {
                var lbox = lightbox();
                lbox.remove();
            };

            /**
             * Open lightbox and set content if necessary.
             *
             * @param content
             * @param appendto
             * @param onclose
             */
            var lightboxopen = function(content, appendto, onclose) {
                appendto = appendto ? appendto : $('body');
                var lbox = lightbox(appendto, onclose);
                if (content) {
                    var contentdiv = $('#snap-light-box-content');
                    contentdiv.html('');
                    contentdiv.append(content);
                }
                lbox.addClass('state-visible');
            };

            var appendto = $('body');
            var spinner = '<div class="loadingstat three-quarters">' +
                Y.Escape.html(M.util.get_string('loading', 'theme_snap')) +
                '</div>';
            lightboxopen(spinner, appendto, function() {
                $(resourcemod).attr('tabindex', '-1').focus();
                $(resourcemod).removeAttr('tabindex');
            });

            $.ajax({
                type: "GET",
                async: true,
                url: M.cfg.wwwroot + '/theme/snap/rest.php?action=get_media&contextid=' + $(resourcemod).data('modcontext'),
                success: function(data) {
                    if (ajaxNotify.ifErrorShowBestMsg(data)) {
                        return;
                    }
                    lightboxopen(data.html, appendto);

                    updateModCompletion($(resourcemod), data.completionhtml);

                    $(document).trigger('snapContentRevealed');

                    $('#snap-light-box').focus();
                }
            });

        };

        return {

            init: function() {

                // Listeners
                listenPageModuleReadMore();
                listenManualCompletion();

                // Add toggle class for hide/show activities/resources - additional to moodle adding dim.
                $(document).on("click", '[data-action=hide],[data-action=show]', function() {
                    $(this).closest('li.activity').toggleClass('draft');
                });

                // Make lightbox for list display of resources.
                $(document).on('click', '.js-snap-media .snap-asset-link [href*="/mod/resource/view.php?id="]', function(e) {
                    lightboxMedia($(this).closest('.snap-resource'));
                    e.preventDefault();
                });

                // Make resource cards clickable.
                $(document).on('click', '.snap-resource-card .snap-resource', function(e) {
                    var trigger = $(e.target),
                        hreftarget = '_self',
                        link = $(trigger).closest('.snap-resource').find('.snap-asset-link a'),
                        href = '';
                    if (link.length > 0) {
                        href = $(link).attr('href');
                    }

                    // Excludes any clicks in the actions menu, on links or forms.
                    var selector = '.snap-asset-completion-tracking, .snap-asset-actions, .contentafterlink a, .ally-actions';
                    var withintarget = $(trigger).closest(selector).length;
                    if (!withintarget) {
                        if ($(this).hasClass('js-snap-media')) {
                            lightboxMedia(this);
                        } else {
                            if (href === '') {
                                return;
                            }
                            if ($(link).attr('target') === '_blank') {
                                hreftarget = '_blank';
                            }
                            window.open(href, hreftarget);
                        }
                        e.preventDefault();
                    }
                });
            }
        };
    }
);
