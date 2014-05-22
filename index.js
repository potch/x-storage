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

    get: function (key) {
      var self = this;
      if (self._ready) {
        return self._get(key);
      } else {
        return self.ready.then(function() {
          return self._get(key);
        });
      }
    },

    _get: function (key) {
      var self = this;
      var storeName = self.storeName;
      var transaction = self.db.transaction([storeName]);
      var store = transaction.objectStore(storeName);
      return new Promise(function (resolve, reject) {
        wrap(store.get(key)).then(function(row) {
          resolve(row ? row.value : undefined);
        }, reject);
      });
    },

    set: function (key, value) {
      var self = this;
      if (self._ready) {
        return self._set(key, value);
      } else {
        return self.ready.then(function() {
          return self._set(key, value);
        });
      }
    },

    _set: function (key, value) {
      var self = this;
      var storeName = self.storeName;
      var transaction = self.db.transaction([storeName], 'readwrite');
      var store = transaction.objectStore(storeName);
      return wrap(store.put({ 'key': key, 'value': value }));
    },

    remove: function (key) {
      var self = this;
      if (self._ready) {
        return self._remove(key);
      } else {
        return self.ready.then(function() {
          return self._remove(key);
        });
      }
    },

    _remove: function (key) {
      var self = this;
      var storeName = self.storeName;
      var transaction = self.db.transaction([storeName], 'readwrite');
      var store = transaction.objectStore(storeName);
      return wrap(store.delete(key));
    },

    getAll: function() {
      var self = this;
      if (self._ready) {
        return self._getAll();
      } else {
        return self.ready.then(function() {
          return self._getAll();
        });
      }
    },

    _getAll: function() {
      var self = this;
      var storeName = self.storeName;
      var transaction = self.db.transaction([storeName]);
      var store = transaction.objectStore(storeName);
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

    clear: function () {
      var self = this;
      if (self._ready) {
        return self._clear();
      } else {
        return self.ready.then(function() {
          return self._clear();
        });
      }
    },

    _clear: function() {
      var self = this;
      var storeName = self.storeName;
      var transaction = self.db.transaction([storeName], 'readwrite');
      var store = transaction.objectStore(storeName);
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
  StoragePrototype.clear = function (key) {
    return this.storage.clear();
  };

  document.registerElement('key-value', {
    prototype: StoragePrototype
  });

})();
