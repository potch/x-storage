(function () {

  var KEYVALUE_API_VERSION = 1;

  var indexedDB = window.indexedDB ||
                  window.mozIndexedDB ||
                  window.webkitIndexedDB ||
                  window.msIndexedDB;
                  
  var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction 
                    || window.mozIDBTransaction || window.msIDBTransaction;

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
        var store = self.db.createObjectStore(self.storeName, {keyPath: "id", autoIncrement: true});
        store.createIndex('key', 'key', {unique: true});
        store.createIndex('value', 'value');
        resolve(self);
      };
      req.onerror = reject;
    });

    self.ready.then(function() {
      self._ready = true;
    });

  }

  KeyValueStore.prototype = {

    // Internal function: returns the objectStore with the supplied 
    // transaction mode. Defaults to readonly transaction.
    _getObjectStore: function(mode) {
      var self = this;
      mode = typeof mode !== 'undefined' ? mode : 'readonly';
      var t = self.db.transaction(self.storeName, mode);
      return t.objectStore(self.storeName);
    }, 

    // Internal function to defer the execution of a supplied function
    // until the database is ready.
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

    /**
     * Get the value for a given key.
     * @param  {string|number} key
     * @return {promise}
     */
    get: function (key) {
      var self = this;
      return self._awaitReady(self._get, arguments);
    },

    _get: function (key) {
      var self = this;
      var store = self._getObjectStore();
      var index = store.index("key");
      return new Promise(function (resolve, reject) {
        wrap(index.get(key)).then(function(row) {
          resolve(row ? row.value : undefined);
        }, reject);
      });
    },

    /**
     * Set the value for a given key.
     * @param {string|number} key
     * @param {string|number|object} value
     * @return {promise}
     */
    set: function (key, value) {
      var self = this;
      return self._awaitReady(self._set, arguments);
    },

    _set: function (key, value) {
      var self = this;
      var store = self._getObjectStore();
      var index = store.index("key");
      return new Promise(function (resolve, reject){
        wrap(index.get(key)).then(function(res){
          store = self._getObjectStore('readwrite');
          var item = {
            'key': key,
            'value': value,
          }
          if (res) { item.id = res.id }
          resolve(wrap(store.put(item)));            
        });
      });
    },

    /**
     * Removes the the entry with the supplied key from the database.
     * @param  {string|number} key
     * @return {promise}
     */
    remove: function (key) {
      var self = this;
      return self._awaitReady(self._remove, arguments);
    },

    _remove: function (key) {
      var self = this;
      var store = self._getObjectStore('readwrite');
      var index = store.index("key");
      return wrap(index.delete(key));
    },

    /**
     * Returns all databse entries.
     * @param  {string}  [orderBy='key'] The index to order the results by.
     *                                   Can be 'key', 'value' or 'insertionTime'.
     * @param  {boolean} [reverse=false] Reverse the order of the results.
     * @return {promise}
     */
    getAll: function(options) {
      var self = this;
      return self._awaitReady(self._getAll, arguments);
    },

    _getAll: function(options) {
      var self = this;
      return new Promise(function (resolve,reject) {
        // Get all entries by calling _getRange
        resolve(self._getRange(options));
      });
    },

    /**
     * Returns a range of database entries.
     * @param  {number}  count
     * @param  {string}  [orderBy='key'] The index to order the results by.
     *                                   Can be 'key', 'value' or 'insertionTime'.
     * @param  {any}     [start]         The start entry of the results.
     *                                   Dependent on the selected index.
     * @param  {boolean} [reverse=false] Reverse the order of the results.
     * @return {promise}
     */
    getRange: function(options) {
      var self = this;
      return self._awaitReady(self._getRange, arguments);
    },

    _getRange: function(options) {
      options = options || {};
      var self = this;
      var store = self._getObjectStore();
      var allItems = [];
      var counter = 0;
      var orderBy = options.orderBy || 'key';
      var lowerBound = options.start ? IDBKeyRange.lowerBound(options.start) : null;
      var direction = options.reverse ? 'prev' : 'next';
      var count = options.count || undefined;
      return new Promise(function(resolve,reject){
        if (orderBy === 'value' || orderBy === 'key') {
          var index = store.index(orderBy);
          var cursorRequest = index.openCursor(lowerBound, direction);          
        } else {
          var cursorRequest = store.openCursor(lowerBound, direction);
        }
        cursorRequest.onsuccess = function(e){
          var cursor = e.target.result;
          if (cursor === null || cursor === undefined 
              || (counter !== undefined && counter >= count)) {
            resolve(allItems);
          } else {
            allItems.push(cursor.value);
            counter++;
            cursor.continue();
          }
        }
      });

    },

    /**
     * Returns the number of database entries.
     * @return {promise}
     */
    size: function() {
      var self = this;
      return self._awaitReady(self._size);
    },

    _size: function() {
      var self = this;
      var store = self._getObjectStore();
      return wrap(store.count());
    },

    /**
     * Deletes all database entries.
     * @return {promise}
     */
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
  StoragePrototype.getAll = function (options) {
    return this.storage.getAll(options);
  };
  StoragePrototype.size = function (key) {
    return this.storage.size();
  };
  StoragePrototype.clear = function (key) {
    return this.storage.clear();
  };
  StoragePrototype.getRange = function (options) {
    return this.storage.getRange(options);
  };

  document.registerElement('key-value', {
    prototype: StoragePrototype
  });

})();