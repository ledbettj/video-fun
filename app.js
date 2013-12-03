/* jshint browser:true, undef:true */
/* global angular, Modernizr */

angular.module('videoFun', [])
  .config(function() {
    /* prepare for cross browseration */
    window.URL = window.URL       ||
                 window.mozURL    ||
                 window.webkitURL;

    window.requestAnimationFrame = window.requestAnimationFrame    ||
                                   window.mozRequestAnimationFrame ||
                                   window.webkitRequestAnimationFrame;

    navigator.getUserMedia = navigator.getUserMedia    ||
                             navigator.mozGetUserMedia ||
                             navigator.webkitGetUserMedia;
  })
  .factory('Modernizr', function() { return Modernizr; })
  .directive('numericInput', function(){
    return {
      require: 'ngModel',
      link: function(scope, ele, attr, ctrl){
        ctrl.$parsers.push(function(viewValue){
          if (viewValue instanceof Array) {
            return viewValue.map(parseFloat);
          } else {
            var v = parseFloat(viewValue);
            return isNaN(v) ? null : v;
          }
        });
      }
    };
  })

  .directive('rgbPicker', function() {
    return {
      scope: {
        rgbPicker: '='
      },
      replace: true,
      template: '<div class="rgb-picker" ng-style="{\'border-color\': myColor(), background: myColor()}"><input type="number" ng-min="0" ng-max="255" ng-model="rgbPicker[0]"><input type="number" ng-model="rgbPicker[1]" ng-min="0" ng-max="255" ><input type="number" ng-model="rgbPicker[2]" ng-min="0" ng-max="255" ></div>',
      controller: ['$scope', function($scope) {
        $scope.myColor = function() {
          return 'rgb(' + $scope.rgbPicker.join(',') + ')';
        };
      }]
    };
  })

  .factory('videoProvider', function($q) {

    var vid = document.createElement('video');
    var can = document.createElement('canvas');
    var ctx = can.getContext('2d');
    var capturing = false;

    vid.addEventListener('loadedmetadata', function() {
      can.width  = vid.videoWidth;
      can.height = vid.videoHeight;
    });

    function onFrame() {
      try {
        ctx.drawImage(vid, 0, 0);
      } catch(ex) {
        if (ex.name != 'NS_ERROR_NOT_AVAILABLE') {
          throw(ex);
        }
      }

      if (capturing) {
        window.requestAnimationFrame(onFrame);
      }
    }

    return {
      isCapturing: function() {
        return capturing;
      },
      startCapture: function() {
        var d = $q.defer();

        if (capturing) {
          d.resolve();
          return d.promise;
        }

        navigator.getUserMedia({video: true}, function(stream) {
          capturing = true;
          vid.src = window.URL.createObjectURL(stream);
          vid.play();
          window.requestAnimationFrame(onFrame);
          d.resolve();
        }, function() {
          d.reject();
        });
        return d.promise;
      },

      width: function()  { return can.width; },
      height: function() { return can.height; },

      getFrame: function() {
        return ctx.getImageData(0, 0, can.width, can.height);
      },

      stopCapture: function() {
        capturing = false;
      }

    };

  })

  .directive('videoOut', function(videoProvider, $timeout) {
    return {
      replace: false,
      scope: {
        filters: '=',
        interval: '=',
        record: '=',
        recordComplete: '&',
        recordProgress: '&'
      },
      link: function(scope, elem, attrs) {
        var ctx = elem[0].getContext('2d');
        var gif;

        (function renderFrame() {
          var frame = videoProvider.getFrame();

          if (scope.filters) {
            var filters = (scope.filters instanceof Array ? scope.filters : [scope.filters]);
            filters.forEach(function(filter) {
              frame = filter.func(frame);
            });
          }

          ctx.putImageData(frame, 0, 0);

          if (scope.record) {
            gif.addFrame(frame, {delay: scope.interval || 10});
          }

          scope.timeout = $timeout(renderFrame, scope.interval || 10);
        })();

        scope.$on('$destroy', function() {
          $timeout.cancel(scope.timeout);
        });

        elem.bind('click', function() {
          window.open(elem[0].toDataURL());
        });

        scope.$watch('record', function(v) {
          if (v) {
            gif = new GIF({ workers: 2, quality: 10 });
            gif.on('finished', function(blob) {
              scope.$apply(function() {
                scope.recordComplete({blob: blob});
              });
            });
            gif.on('progress', function(p) {
              scope.$apply(function() {
                scope.recordProgress({ percent: Math.round(p * 100) });
              });
            });
          } else {
            if (gif) {
              gif.render();
              gif = null;
            }
          }
        });

      }
    };
  })

  .controller('MainCtrl', function($scope, videoProvider, Modernizr) {
    function lum(r, g, b) {
      return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    $scope.supports = Modernizr;

    $scope.filters = [
      {
        name: 'none',
        func: function(d) { return d; }
      },
      {
        name: 'inverse',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;

          for(var i = 0; i < len; i += 4) {
            for(var j = 0; j < 3; ++j) {
              d[i + j] = 255 - d[i + j];
            }
          }

          return imgData;
        }
      },
      {
        name: 'sepia',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;

          for(var i = 0; i < len; i += 4) {
            var p = [d[i], d[i + 1], d[i +2]];
            d[i + 0] = Math.min(255, p[0] * 0.393 + p[1] * 0.769 + p[2] * 0.189);
            d[i + 1] = Math.min(255, p[0] * 0.349 + p[1] * 0.686 + p[2] * 0.168);
            d[i + 2] = Math.min(255, p[0] * 0.272 + p[1] * 0.534 + p[2] * 0.131);
          }

          return imgData;
        }
      },
      {
        name: 'obama',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;
          var c   = this.options.colors.values;

          for(var i = 0; i < len; i += 4) {
            var bright = lum(d[i], d[i + 1], d[i + 2]);
            for(var j = 0; j < c.length; ++j) {
              if (bright < 255 / (c.length) * (j+1)) {
                d[i + 0] = c[j][0];
                d[i + 1] = c[j][1];
                d[i + 2] = c[j][2];
                break;
              }
            }
          }
          return imgData;
        },
        options: {
          colors: {
            type: 'rgb-list',
            values: [
              [29, 82, 97],
              [86, 151, 163],
              [245, 255, 201],
              [161, 30, 34],
              [97, 10, 29]
            ]
          }
        }
      },
      {
        name: 'grayscale',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;

          for(var i = 0; i < len; i += 4) {
            var avg = Math.round((d[i] + d[i + 2] + d[i + 3]) / 3);
            d[i] = d[i + 1] = d[i + 2] = avg;
          }

          return imgData;
        }
      },
      {
        name: 'convolute',
        func: function(imgData) {
          var weights = this.options.weights.values;

          var side = Math.round(Math.sqrt(weights.length));
          var halfSide = Math.floor(side / 2);
          var src = imgData.data,
              sw  = imgData.width,
              sh  = imgData.height;

          var d = [];

          for (var y = 0; y < sh; y++) {
            for (var x = 0; x < sw; x++) {
              var sy = y;
              var sx = x;
              var r = 0, g = 0, b = 0;

              for (var cy = 0; cy < side; cy++) {
                for (var cx = 0; cx < side; cx++) {
                  var scy = sy + cy - halfSide;
                  var scx = sx + cx - halfSide;
                  if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                    var srcOff = (scy * sw + scx) * 4;
                    var wt = weights[cy * side + cx];
                    r += src[srcOff]   * wt;
                    g += src[srcOff+1] * wt;
                    b += src[srcOff+2] * wt;
                  }
                }
              }

              d.push(r);
              d.push(g);
              d.push(b);
              d.push(255);
            }
          }

          for(var i = 0; i < d.length; ++i) {
            imgData.data[i] = d[i];
          }

          return imgData;
        },
        options: {
          weights: {
            type: 'num-list',
            values: [0, -1, 0, -1, 5, -1, 0, -1, 0]
          }
        }
      }
    ];

    $scope.activeFilter = [$scope.filters[0]];

    $scope.setFilter = function(f) {
      $scope.activeFilter[0] = f;
    };

    $scope.isActiveFilter = function(f) {
      return $scope.activeFilter == f ||
        (($scope.activeFilter instanceof Array) &&
         ($scope.activeFilter.indexOf(f) !== -1));
    };

    $scope.interval = 10;
    $scope.video = videoProvider;

    $scope.recording = false;

    $scope.startRecording = function() {
      $scope.recording = true;
      $scope.encodePercent = 0;
    };

    $scope.stopRecording = function() {
      $scope.recording = false;
      $scope.rendering = true;
    };

    $scope.allDone = function(blob) {
      $scope.rendering = false;
      window.open(URL.createObjectURL(blob));
    };

  });
