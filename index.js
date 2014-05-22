(function () {

  var KEYVALUE_API_VERSION = 1;

  var indexedDB = window.indexedDB ||
                  window.mozIndexedDB ||
                  window.webkitIndexedDB ||
                  window.msIndexedDB;

  function wrap(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function (e) {
        resolve(req.result);
      };
      req.onerror = function (e) {
        reject(req.errorCode);
      };
    });
  }

  function KeyValueStore(storeName) {

    var self = this;
    self._ready = false;
    self.storeName = storeName;

    self.ready = new Promise(function (resolve, reject) {
      if (!indexedDB) {
        reject('No indexedDB implementation found!');
      }
      var req = indexedDB.open(self.storeName, KEYVALUE_API_VERSION);
      req.onsuccess = function (e) {
        self.db = req.result;
        resolve(self);
      };
      req.onupgradeneeded = function (e) {
        self.db = req.result;
        self.db.createObjectStore(self.storeName, { keyPath: 'key' });
        resolve(self);
      };
      req.onerror = reject;
    });

    self.ready.then(function() {
      self._ready = true;
    });

  }

  KeyValueStore.prototype = {

    _getObjectStore: function(mode) {
      var self = this;
      mode = typeof mode !== 'undefined' ? mode : 'readonly';
      var t = self.db.transaction(self.storeName, mode);
      return t.objectStore(self.storeName);
    }, 

    _awaitReady: function(fn, args) {
      var self = this;
      if (self._ready) {
        return fn.apply(self, args);
      } else {
        return self.ready.then(function() {
          return fn.apply(self, args);
        })
      }
    },

    get: function (key) {
      var self = this;
      return self._awaitReady(self._get,[key]);
    },

    _get: function (key) {
      var self = this;
      var store = self._getObjectStore()
      return new Promise(function (resolve, reject) {
        wrap(store.get(key)).then(function(row) {
          resolve(row ? row.value : undefined);
        }, reject);
      });
    },

    set: function (key, value) {
      var self = this;
      return self._awaitReady(self._set,[key,value]);
    },

    _set: function (key, value) {
      var self = this;
      var store = self._getObjectStore('readwrite');
      return wrap(store.put({ 'key': key, 'value': value }));
    },

    remove: function (key) {
      var self = this;
      return self._awaitReady(self._remove,[key]);
    },

    _remove: function (key) {
      var self = this;
      var store = self._getObjectStore('readwrite');
      return wrap(store.delete(key));
    },

    getAll: function() {
      var self = this;
      return self._awaitReady(self._getAll);
    },

    _getAll: function() {
      var self = this;
      var store = self._getObjectStore();
      var allItems = [];
      return new Promise(function(resolve,reject){
        var cursorRequest = store.openCursor();
        cursorRequest.onsuccess = function(e){
          var cursor = e.target.result;
          if (cursor === null || cursor === undefined) {
            resolve(allItems);
          } else {
            allItems.push(cursor.value);
            cursor.continue();
          }
        }
      });
    },

    getRange: function(count, startKey) {
      var self = this;
      return self._awaitReady(self._getRange, [count, startKey]);
    },

    _getRange: function(count, startKey) {
      console.log(arguments);
      var self = this;
      var store = self._getObjectStore();
      var allItems = [];
      return new Promise(function(resolve,reject){
        var index = 0;
        if (startKey) {
          var lowerBound = IDBKeyRange.lowerBound(startKey);
          var cursorRequest = store.openCursor(lowerBound);
        } else {
          var cursorRequest = store.openCursor();
        };
        cursorRequest.onsuccess = function(e){
          var cursor = e.target.result;
          if (cursor === null || cursor === undefined || index >= count) {
            resolve(allItems);
          } else {
            allItems.push(cursor.value);
            index++;
            cursor.continue();
          }
        }
      });
    },

    size: function() {
      var self = this;
      return self._awaitReady(self._size);
    },

    _size: function() {
      var self = this;
      var store = self._getObjectStore();
      return wrap(store.count());
    },

    clear: function () {
      var self = this;
      return self._awaitReady(self._clear);
    },

    _clear: function() {
      var self = this;
      var store = self._getObjectStore('readwrite');
      return wrap(store.clear());
    }
        
  };


var StoragePrototype = Object.create(HTMLElement.prototype);

  StoragePrototype.createdCallback = function () {
    this.name = this.getAttribute('name') || 'storage';
    this.storage = new KeyValueStore(this.name);
  };

  StoragePrototype.attachedCallback = function () {

  };

  StoragePrototype.detatchedCallback = function () {

  };

  StoragePrototype.attributeChangedCallback = function (attr, oldVal, newVal) {

  };

  StoragePrototype.get = function (key) {
    return this.storage.get(key);
  };

  StoragePrototype.set = function (key, value) {
    return this.storage.set(key, value);
  };

  StoragePrototype.remove = function (key) {
    return this.storage.remove(key);
  };
  StoragePrototype.getAll = function (key) {
    return this.storage.getAll();
  };
  StoragePrototype.size = function (key) {
    return this.storage.size();
  };
  StoragePrototype.clear = function (key) {
    return this.storage.clear();
  };
  StoragePrototype.getRange = function (count, startKey) {
    return this.storage.getRange(count, startKey);
  };

  document.registerElement('key-value', {
    prototype: StoragePrototype
  });

})();
