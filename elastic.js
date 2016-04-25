/*
 * angular-elastic v2.5.1
 * (c) 2014 Monospaced http://monospaced.com
 * License: MIT
 */

if (typeof module !== 'undefined' &&
    typeof exports !== 'undefined' &&
    module.exports === exports){
  module.exports = 'monospaced.elastic';
}

angular.module('monospaced.elastic', [])

  .constant('msdElasticConfig', {
    append: ''
  })

  .directive('msdElastic', [
    '$timeout', '$window', '$document', 'msdElasticConfig',
    function($timeout, $window, $document, config) {
      'use strict';

      var mirrorStore = {};

      return {
        restrict: 'A, C',
        link: function(scope, element, attrs) {
          var group = attrs.msdElasticGroup, result, $mirror, destroy, forceAdjust;

          element.on('focus', function() {
            if (!result) {
              result = init(scope, element, attrs, mirrorStore[group], group);
              $mirror = mirrorStore[group] = result.$mirror;
              destroy = result.destroy;
              forceAdjust = result.forceAdjust;
            }

            $mirror.val(element.val());
            $timeout(forceAdjust, 10, false);
          });

          scope.$on('$destroy', function() {
            if (destroy) { destroy() }
          });
        }
      };

      function init(scope, element, attrs, storedMirror, groupName) {
        // cache a reference to the DOM element
        var ta = element[0],
            $ta = element;

        // create a textarea container
        var $mirrorContainer = $document.find('.msd-elastic-container');
        if (!$mirrorContainer.length) {
          $mirrorContainer = angular.element('<div class="msd-elastic-container"></div>');
          angular.element(document.body).append($mirrorContainer);
        }

        // ensure the element is a textarea, and browser is capable
        if (ta.nodeName !== 'TEXTAREA' || !$window.getComputedStyle) {
          return;
        }

        // set these properties before measuring dimensions
        $ta.css({
          'overflow': 'hidden',
          'overflow-y': 'hidden',
          'word-wrap': 'break-word'
        });

        // force text reflow
        var text = ta.value;
        ta.value = '';
        ta.value = text;

        var append = attrs.msdElastic ? attrs.msdElastic.replace(/\\n/g, '\n') : config.append,
            $win = angular.element($window),
            mirrorInitStyle = 'position: absolute; top: -999px; right: auto; bottom: auto;' +
                              'left: 0; overflow: hidden; -webkit-box-sizing: content-box;' +
                              '-moz-box-sizing: content-box; box-sizing: content-box;' +
                              'min-height: 0 !important; height: 0 !important; padding: 0;' +
                              'word-wrap: break-word; border: 0;',
            // mirrorInitStyle = 'position: absolute; top: 0px; right: auto; bottom: auto;' +
            //                   'left: 0; -webkit-box-sizing: content-box;' +
            //                   '-moz-box-sizing: content-box; box-sizing: content-box;' +
            //                   'padding: 0;' +
            //                   'word-wrap: break-word; border: 0;' +
            //                   'z-index: 1000;',
            $mirror = (storedMirror || angular.element('<textarea class="msd-elastic-mirror-for-' + groupName +
                                                       '" aria-hidden="true" tabindex="-1" ' +
                                                       'style="' + mirrorInitStyle + '"/>').data('elastic', true)),
            mirror = $mirror[0],
            taStyle = getComputedStyle(ta),
            resize = taStyle.getPropertyValue('resize'),
            borderBox = taStyle.getPropertyValue('box-sizing') === 'border-box' ||
                        taStyle.getPropertyValue('-moz-box-sizing') === 'border-box' ||
                        taStyle.getPropertyValue('-webkit-box-sizing') === 'border-box',
            boxOuter = !borderBox ? {width: 0, height: 0} : {
              width:  parseInt(taStyle.getPropertyValue('border-right-width'), 10) +
                      parseInt(taStyle.getPropertyValue('padding-right'), 10) +
                      parseInt(taStyle.getPropertyValue('padding-left'), 10) +
                      parseInt(taStyle.getPropertyValue('border-left-width'), 10),
              height: parseInt(taStyle.getPropertyValue('border-top-width'), 10) +
                      parseInt(taStyle.getPropertyValue('padding-top'), 10) +
                      parseInt(taStyle.getPropertyValue('padding-bottom'), 10) +
                      parseInt(taStyle.getPropertyValue('border-bottom-width'), 10)
            },
            minHeightValue = parseInt(taStyle.getPropertyValue('min-height'), 10),
            heightValue = parseInt(taStyle.getPropertyValue('height'), 10),
            minHeight = Math.max(minHeightValue, heightValue) - boxOuter.height,
            maxHeight = parseInt(taStyle.getPropertyValue('max-height'), 10),
            mirrored,
            active,
            copyStyle = ['font-family',
                         'font-size',
                         'font-weight',
                         'font-style',
                         'letter-spacing',
                         'line-height',
                         'text-transform',
                         'word-spacing',
                         'word-wrap',
                         'word-break',
                         'text-indent'];

        // exit if elastic already applied (or is the mirror element)
        if ($ta.data('elastic')) {
          return;
        }

        // Opera returns max-height of -1 if not set
        maxHeight = maxHeight && maxHeight > 0 ? maxHeight : 9e4;

        // append mirror to the DOM
        if (!storedMirror && mirror.parentNode !== $mirrorContainer[0]) {
          $mirrorContainer.append(mirror);
        }

        // set resize and apply elastic
        $ta.css({
          'resize': (resize === 'none' || resize === 'vertical') ? 'none' : 'horizontal'
        }).data('elastic', true);

        /*
         * methods
         */

        function initMirror() {
          var mirrorStyle = mirrorInitStyle;

          mirrored = ta;
          // copy the essential styles from the textarea to the mirror
          taStyle = getComputedStyle(ta);
          angular.forEach(copyStyle, function(val) {
            mirrorStyle += val + ':' + taStyle.getPropertyValue(val) + ';';
          });
          mirror.setAttribute('style', mirrorStyle);
        }

        function adjust() {
          var taHeight,
              taComputedStyleWidth,
              mirrorHeight,
              width,
              overflow,
              ngHided,
              jqHided;

          if (mirrored !== ta) {
            initMirror();
          }

          // active flag prevents actions in function from calling adjust again
          if (!active) {
            active = true;

            mirror.value = ta.value + append; // optional whitespace to improve animation
            mirror.style.overflowY = ta.style.overflowY;

            taHeight = ta.style.height === '' ? 'auto' : parseInt(ta.style.height, 10);

            taComputedStyleWidth = getComputedStyle(ta).getPropertyValue('width');

            // ensure getComputedStyle has returned a readable 'used value' pixel width
            if (taComputedStyleWidth.substr(taComputedStyleWidth.length - 2, 2) === 'px') {
              // update mirror width in case the textarea width has changed
              width = parseInt(taComputedStyleWidth, 10) - boxOuter.width;
              mirror.style.width = width + 'px';
            } else if (element.jquery) {
              ngHided = element.hasClass('ng-hide');
              jqHided = !ngHided && element.css('display') === 'none';
              if (ngHided) { element.removeClass('ng-hide'); }
              if (jqHided) { element.show(); }
              mirror.style.width = element.width() + 'px';
              if (ngHided) { element.addClass('ng-hide') }
              if (jqHided) { element.hide(); }
            }

            mirrorHeight = mirror.scrollHeight;

            if (mirrorHeight > maxHeight) {
              mirrorHeight = maxHeight;
              overflow = 'scroll';
            } else if (mirrorHeight < minHeight) {
              mirrorHeight = minHeight;
            }
            mirrorHeight += boxOuter.height;
            ta.style.overflowY = overflow || 'hidden';

            if (taHeight !== mirrorHeight) {
              scope.$emit('elastic:resize', $ta, taHeight, mirrorHeight);
              ta.style.height = mirrorHeight + 'px';
            }

            // small delay to prevent an infinite loop
            $timeout(function() {
              active = false;
            }, 1, false);

          }
        }

        function forceAdjust() {
          active = false;
          adjust();
        }

        /*
         * initialise
         */

        // listen
        if ('onpropertychange' in ta && 'oninput' in ta) {
          // IE9
          ta['oninput'] = ta.onkeyup = adjust;
        } else {
          ta['oninput'] = adjust;
        }

        $win.bind('resize', forceAdjust);

        var valueUnwatcher = scope.$watch(function() {
          return element.val()
        }, function(newValue) {
          forceAdjust();
        });

        var adjustUnlistener = scope.$on('elastic:adjust', function() {
          initMirror();
          forceAdjust();
        });

        $timeout(adjust, 0, false);

        /*
         * destroy
         */
        return {
          $mirror: $mirror,
          forceAdjust: forceAdjust,
          destroy: function() {
            $ta.data('elastic', false);
            $ta.attr('style', '');
            valueUnwatcher();
            adjustUnlistener();
            $win.unbind('resize', forceAdjust);
            if ('onpropertychange' in ta && 'oninput' in ta) {
              // IE9
              ta['oninput'] = ta.onkeyup = null;
            } else {
              ta['oninput'] = null;
            }
          }
        };
      }
    }
  ]);
