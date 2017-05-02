// ==UserScript==
// @include https://2ch.hk/*/res/*
// @include https://2ch.pm/*/res/*
// @include https://2ch.re/*/res/*
// @include https://2ch.tf/*/res/*
// @include https://2ch.wf/*/res/*
// @include https://2ch.yt/*/res/*
// @include https://2-ch.so/*/res/*
// @run-at document-start
// @grant none
// ==/UserScript==
(() => {
  "use strict";

  const markDeletedPosts = true;


  function main() {
    Thread.init();
  };


  var Thread = (() => {
    let threadData, threadId;
    let deletedPostIdsMap = {};
    let lastDeletedPostIds = [];

    function init() {
      threadId = getThreadId(document.location.href);
      if (!threadId) { return; }
      threadData = null;

      if (markDeletedPosts) { Styler.init(); }
      XhrProxifier.init();

      (function cache() {
        // First update populates Thread's post cache.
        if (document.readyState === 'complete') {
          window.removeEventListener('load', cache, false);

          // Check if cache had already been populated by auto update.
          if (threadData) {
            return;
          }

          let updateButton = document.querySelector('#ABU-getnewposts > a');
          if (updateButton) {
            updateButton.click();
          } else {
            console.log('MakabaUndelete: Couldn\'t find update button!');
          }
        } else {
          window.addEventListener('load', cache, false);
        }
      })();
    };

    function isCurrentThread(url) {
      return getThreadId(url) === threadId;
    };

    function getThreadId(url) {
      // 2ch.hk, 2ch.pm, 2ch.re, 2ch.tf, 2ch.wf, 2ch.yt, 2-ch.so
      const regExp = /https:\/\/2-?ch.[a-z]{2}\/[a-z]+\/res\/([0-9]+)\.(html|json)/;
      let match = url.match(regExp);
      return (match && match.length > 1) ? match[1] : null;
    };

    function getLastDeletedPostIds() {
      return lastDeletedPostIds;
    };

    function update(json) {
      lastDeletedPostIds.length = 0;

      let newData;
      try {
        newData = JSON.parse(json);
      } catch(e) {
        return null;
      }
      if (!newData.threads || !newData.threads.length
          || !newData.threads[0].posts) {
        return null;
      }
      if (!threadData) {
        threadData = newData;
        return json;
      }

      let oldData = threadData;
      threadData = newData;
      let oldPosts = oldData.threads[0].posts;
      let newPosts = threadData.threads[0].posts;

      let newPostIdsMap = {};
      for (let post of newPosts) {
        newPostIdsMap[post.num] = true;
      }

      let mergePerformed = false;
      for (let post of oldPosts) {
        let postId = post.num;
        if (!newPostIdsMap[postId]) {
          if (!deletedPostIdsMap[postId]) {
            deletedPostIdsMap[postId] = true;
            lastDeletedPostIds.push(postId);
          }
          newPosts.push(post);
          mergePerformed = true;
        }
      }

      if (!mergePerformed) {
        return json;
      }

      newPosts.sort((a, b) => (a.num - b.num));
      return JSON.stringify(threadData);
    };

    return {init: init
            , update: update
            , isCurrentThread: isCurrentThread
            , getLastDeletedPostIds: getLastDeletedPostIds};
  })();


  var XhrProxifier = (() => {
    function init() {
      let RealXhr = XMLHttpRequest;
      Object.defineProperty(window, 'XMLHttpRequest', {value: XhrWrapper});

      function XhrWrapper() {
        return new Proxy(new RealXhr(), XhrProxyHandler);
      };

      var XhrProxyHandler = {
        set: function(target, property, value, receiver) {
          target[property] = value;
          return true;
        },
        get: function(target, property, receiver) {
          let targetProperty = target[property];
          if (typeof(targetProperty) === 'function') {
            return targetProperty.bind(target);
          } else {
            if (property === 'responseText') {
              return handleResponseText(target.responseURL,
                                        target.responseText);
            }
            return targetProperty;
          }
        }
      };
    };

    function handleResponseText(responseUrl, responseText) {
      if (!Thread.isCurrentThread(responseUrl)) { return responseText; }
      let newResponseText = Thread.update(responseText);
      if (markDeletedPosts) {
        let lastDeletedPostIds = Thread.getLastDeletedPostIds();
        if (lastDeletedPostIds.length) {
          Styler.markDeletedPosts(lastDeletedPostIds);
        }
      }
      return newResponseText || responseText;
    };

    return {init: init};
  })();


  var Styler = (() => {
    let styleNode;

    function init() {
      styleNode = document.createElement('style');
      styleNode.type = 'text/css';
      document.getElementsByTagName('head')[0].appendChild(styleNode);
    };

    function markDeletedPosts(postIds) {
      let css = [];
      for (let postId of postIds) {
        css.push('#post-body-', postId, ' {background-color: #FF6666;}\n');
      }
      styleNode.textContent += css.join('');
    };

    return {init: init, markDeletedPosts: markDeletedPosts};
  })();


  main();
})();
