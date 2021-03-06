
ko.utils.domData = new (function () {
    var uniqueId = 0;
    var dataStoreKeyExpandoPropertyName = "__ko__" + (Date.now());

    var
    // We considered using WeakMap, but it has a problem in IE 11 and Edge that prevents using
    // it cross-window, so instead we just store the data directly on the node.
    // See https://github.com/knockout/knockout/issues/2141
    getDataForNode = (node, createIfNotFound) => {
        var dataForNode = node[dataStoreKeyExpandoPropertyName];
        if (!dataForNode && createIfNotFound) {
            dataForNode = node[dataStoreKeyExpandoPropertyName] = {};
        }
        return dataForNode;
    },
    clear = node => {
        if (node[dataStoreKeyExpandoPropertyName]) {
            delete node[dataStoreKeyExpandoPropertyName];
            return true; // Exposing "did clean" flag purely so specs can infer whether things have been cleaned up as intended
        }
        return false;
    };

    return {
        get: (node, key) => {
            var dataForNode = getDataForNode(node, false);
            return dataForNode && dataForNode[key];
        },
        set: (node, key, value) => {
            // Make sure we don't actually create a new domData key if we are actually deleting a value
            var dataForNode = getDataForNode(node, value !== undefined /* createIfNotFound */);
            dataForNode && (dataForNode[key] = value);
        },
        getOrSet: (node, key, value) => {
            var dataForNode = getDataForNode(node, true /* createIfNotFound */);
            return dataForNode[key] || (dataForNode[key] = value);
        },
        clear: clear,

        nextKey: () => (uniqueId++) + dataStoreKeyExpandoPropertyName
    };
})();
