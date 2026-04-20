(function() {
  console.log("[A/B Tests] Tiendanube ScriptTag Loaded v3");

  // --- Store detection ---
  var storeId = null;
  if (window.LS && window.LS.store) {
    storeId = typeof window.LS.store === "object" ? window.LS.store.id : window.LS.store;
  }
  if (!storeId) return;

  var currentProductId = window.LS && window.LS.product ? window.LS.product.id : null;

  // --- Backend URL from script src ---
  var backendUrl = "";
  try {
    var scripts = document.querySelectorAll("script[src]");
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src.indexOf("/script-tag/storefront.js") !== -1) {
        backendUrl = new URL(scripts[i].src).origin;
        break;
      }
    }
  } catch(e) {}
  if (!backendUrl) backendUrl = "https://back.leovenezia.dev";

  // --- Session ID ---
  var SESSION_KEY = "ab_session_id";
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = "s_" + Math.random().toString(36).substr(2, 12) + "_" + Date.now();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  // --- Cookie helpers ---
  function getCookie(n) {
    var v = "; " + document.cookie;
    var p = v.split("; " + n + "=");
    if (p.length === 2) return p.pop().split(";").shift();
    return null;
  }
  function setCookie(n, v, d) {
    var e = "";
    if (d) { var dt = new Date(); dt.setTime(dt.getTime() + d*864e5); e = "; expires=" + dt.toUTCString(); }
    document.cookie = n + "=" + (v||"") + e + "; path=/";
  }

  // --- Send event directly (no queue for critical events) ---
  function sendDirect(evt) {
    var url = backendUrl + "/api/track";
    var body = JSON.stringify(evt);
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        mode: "cors"
      }).catch(function() {});
    } catch(e) {}
  }

  // --- Send via beacon (for unload events) ---
  function sendBeaconEvent(evt) {
    var url = backendUrl + "/api/track";
    var body = JSON.stringify(evt);
    // Use text/plain to avoid CORS preflight (sendBeacon can't do preflight)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    } else {
      // Fallback: synchronous XHR
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, false);
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.send(body);
      } catch(e) {}
    }
  }

  function makeEvent(testId, group, eventType, payload) {
    return {
      store_id: storeId,
      test_id: testId,
      variant: group,
      event_type: eventType,
      session_id: sessionId,
      payload: payload || null
    };
  }

  // --- Fetch config and run ---
  fetch(backendUrl + "/script-tag/config/" + storeId)
    .then(function(r) { return r.json(); })
    .then(function(tests) {
      if (!tests || tests.length === 0) return;

      // --- Group assignment ---
      var groups = {};
      tests.forEach(function(test) {
        var ck = "ab_test_group_" + test.id;
        var g = getCookie(ck);
        if (!g) {
          g = Math.random() < 0.5 ? "A" : "B";
          setCookie(ck, g, 30);
        }
        groups[test.id] = g;
      });

      // --- Group enforcement on product pages ---
      if (currentProductId) {
        tests.forEach(function(test) {
          if (currentProductId == test.variant_product_id && groups[test.id] === "A") {
            groups[test.id] = "B";
            setCookie("ab_test_group_" + test.id, "B", 30);
          } else if (currentProductId == test.original_product_id && groups[test.id] === "B") {
            groups[test.id] = "A";
            setCookie("ab_test_group_" + test.id, "A", 30);
          }
        });
      }

      // --- SEO: noindex variant pages ---
      if (currentProductId) {
        if (tests.some(function(t) { return t.variant_product_id == currentProductId; })) {
          var meta = document.createElement("meta");
          meta.name = "robots"; meta.content = "noindex";
          document.head.appendChild(meta);
        }
      }

      // --- Hide products from wrong group ---
      var hiddenIds = tests.map(function(t) {
        return groups[t.id] === "A" ? t.variant_product_id : t.original_product_id;
      });

      var css = hiddenIds.map(function(id) {
        return '[data-product="'+id+'"], [data-product-id="'+id+'"], [data-item-id="'+id+'"], .product-item[data-product-id="'+id+'"], [data-product-id="'+id+'"].js-item-product { display: none !important; }';
      }).join("\n");
      var style = document.createElement("style");
      style.innerHTML = css;
      document.head.appendChild(style);

      var hideObserver = new MutationObserver(function() {
        hiddenIds.forEach(function(id) {
          document.querySelectorAll('a[href*="-'+id+'-"]:not([data-ab-checked]), a[href*="/'+id+'/"]:not([data-ab-checked]), a[href$="-'+id+'"]:not([data-ab-checked])').forEach(function(a) {
            a.setAttribute("data-ab-checked", "true");
            var c = a.closest(".item, .product, .item-product, .js-item-product, .js-product-item, .product-card, .grid-item, article, li");
            if (c) c.style.display = "none";
          });
        });
      });
      hideObserver.observe(document.body, { childList: true, subtree: true });
      hiddenIds.forEach(function(id) {
        document.querySelectorAll('a[href*="-'+id+'-"]:not([data-ab-checked]), a[href*="/'+id+'/"]:not([data-ab-checked]), a[href$="-'+id+'"]:not([data-ab-checked])').forEach(function(a) {
          a.setAttribute("data-ab-checked", "true");
          var c = a.closest(".item, .product, .item-product, .js-item-product, .js-product-item, .product-card, .grid-item, article, li");
          if (c) c.style.display = "none";
        });
      });

      // =============================================
      // CHECKOUT_STARTED: tracked globally (cart/checkout pages)
      // Uses localStorage attribution set on product pages
      // =============================================
      function onceGlobal(key, fn) {
        var k = "ab_" + key;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
        fn();
      }

      function sendCheckoutForAllTests() {
        try {
          var attr = JSON.parse(localStorage.getItem("ab_attribution") || "{}");
          Object.keys(attr).forEach(function(tid) {
            var a = attr[tid];
            onceGlobal("cs_" + tid, function() {
              sendDirect({
                store_id: a.store_id || storeId,
                test_id: tid,
                variant: a.variant,
                event_type: "CHECKOUT_STARTED",
                session_id: a.session_id || sessionId,
                payload: null
              });
            });
          });
        } catch(e) {}
      }

      // Detect checkout intent on any page (cart page, checkout links)
      document.addEventListener("click", function(e) {
        var link = e.target.closest && e.target.closest(
          'a[href*="/checkout"],' +
          'a[href*="/comprar"],' +
          '.js-go-to-checkout,' +
          '.btn-checkout,' +
          '.js-checkout-btn,' +
          '[data-action="checkout"],' +
          'input[name="go_to_checkout"],' +
          'button[name="go_to_checkout"],' +
          '.cart-btn-checkout,' +
          '#go-to-checkout'
        );
        if (link) sendCheckoutForAllTests();
      });
      document.addEventListener("submit", function(e) {
        var form = e.target;
        if (form && form.action && (form.action.indexOf("/checkout") !== -1 || form.action.indexOf("/comprar") !== -1)) {
          sendCheckoutForAllTests();
        }
      });
      // Also detect if we're already ON the checkout page
      if (window.location.pathname.indexOf("/checkout") !== -1) {
        sendCheckoutForAllTests();
      }

      // =============================================
      // TRACKING: Only on product pages with active test
      // =============================================
      if (!currentProductId) return;

      var activeTest = tests.find(function(t) {
        return t.original_product_id == currentProductId || t.variant_product_id == currentProductId;
      });
      if (!activeTest) return;

      var group = groups[activeTest.id];
      var testId = activeTest.id;

      // Helper: one-time session key check
      function once(key, fn) {
        var k = "ab_" + key + "_" + testId;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
        fn();
      }

      // --- 1. PAGE_VIEW (unique per session, sent immediately) ---
      once("pv", function() {
        sendDirect(makeEvent(testId, group, "PAGE_VIEW"));
      });

      // --- 2. TIME_ON_PAGE ---
      var pageEnteredAt = Date.now();
      var lastTimeSent = 0;
      function sendTimeUpdate() {
        var seconds = Math.round((Date.now() - pageEnteredAt) / 1000);
        if (seconds > lastTimeSent && seconds >= 1) {
          lastTimeSent = seconds;
          sendDirect(makeEvent(testId, group, "TIME_ON_PAGE", { duration_seconds: seconds }));
        }
      }
      // Send precise time on page exit (keepalive ensures fetch completes)
      window.addEventListener("beforeunload", sendTimeUpdate);
      window.addEventListener("pagehide", sendTimeUpdate);
      document.addEventListener("visibilitychange", function() {
        if (document.visibilityState === "hidden") sendTimeUpdate();
      });
      document.addEventListener("turbolinks:before-visit", sendTimeUpdate);
      document.addEventListener("page:before-change", sendTimeUpdate);
      // Safety net: periodic update every 30s in case exit events don't fire
      setInterval(sendTimeUpdate, 30000);

      // --- 3. IMAGE_CLICK (generic: any click on img/thumbnail inside product detail) ---
      // Tiendanube product pages have a main product container. We detect clicks on any
      // image element within the page that's part of the product gallery area.
      document.addEventListener("click", function(e) {
        var el = e.target;
        // Check if clicked element is an image or is inside a link/container wrapping an image
        var isImg = el.tagName === "IMG" || (el.closest && el.closest("a img, button img, [data-zoom-image], .swiper-slide, .carousel-slide, .product-gallery, .product-image"));
        if (!isImg && el.tagName !== "IMG") {
          // Also check if the click target contains an img child (thumbnail containers)
          var childImg = el.querySelector && el.querySelector("img");
          if (!childImg) return;
        }
        // Exclude images that are clearly not product images (tiny icons, logos)
        var img = el.tagName === "IMG" ? el : (el.querySelector ? el.querySelector("img") : null);
        if (img && img.naturalWidth < 50) return;

        // Must be in the product detail area (not header/footer)
        var productArea = el.closest && el.closest("#product-container, .product-detail, .js-product-detail, .js-product-container, main, [data-product], .product-page, .page-product");
        if (!productArea) return;

        sendDirect(makeEvent(testId, group, "IMAGE_CLICK"));
      });

      // --- 4. DESCRIPTION_INTERACTION (scroll into view of description area) ---
      // We look for the description element using multiple possible selectors
      function findDescriptionEl() {
        var selectors = [
          "#product-description",
          ".product-description",
          ".js-product-description",
          ".description",
          '[data-store="product-description"]',
          ".product-detail .description",
          ".user-content" // common in many Tiendanube templates
        ];
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) return el;
        }
        return null;
      }

      var descEl = findDescriptionEl();
      if (descEl) {
        var descTracked = false;
        var descObserver = new IntersectionObserver(function(entries) {
          if (descTracked) return;
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              descTracked = true;
              descObserver.disconnect();
              sendDirect(makeEvent(testId, group, "DESCRIPTION_INTERACTION", { type: "scroll_into_view" }));
            }
          });
        }, { threshold: 0.3 });
        descObserver.observe(descEl);
      }

      // --- 5. ADD_TO_CART ---
      // Strategy A: Intercept form submit to /cart/add (classic templates)
      document.addEventListener("submit", function(e) {
        var form = e.target;
        if (form && form.action && form.action.indexOf("/cart") !== -1) {
          once("atc", function() {
            sendDirect(makeEvent(testId, group, "ADD_TO_CART"));
          });
        }
      });

      // Strategy B: Intercept click on any add-to-cart button (AJAX templates)
      document.addEventListener("click", function(e) {
        var btn = e.target.closest && e.target.closest(
          'form[action*="/cart"] button[type="submit"],' +
          'form[action*="/cart"] input[type="submit"],' +
          '.js-addtocart,' +
          '.js-add-to-cart,' +
          '.btn-add-to-cart,' +
          '[data-action="add-to-cart"],' +
          'button.add-to-cart,' +
          '#btn-add-to-cart,' +
          '.js-prod-submit-btn,' +
          '.product-form button'
        );
        if (btn) {
          once("atc", function() {
            sendDirect(makeEvent(testId, group, "ADD_TO_CART"));
          });
        }
      });

      // Strategy C: Listen for Tiendanube's custom JS event (if available)
      // Some templates dispatch a custom event or modify the cart counter
      var cartCountEl = document.querySelector(".js-cart-widget-amount, .cart-widget-amount, #cart-count, .js-cart-count");
      if (cartCountEl) {
        var cartObserver = new MutationObserver(function() {
          once("atc", function() {
            sendDirect(makeEvent(testId, group, "ADD_TO_CART"));
          });
        });
        cartObserver.observe(cartCountEl, { childList: true, characterData: true, subtree: true });
      }

      // --- Store attribution in localStorage for webhook correlation ---
      try {
        var attrKey = "ab_attribution";
        var attr = JSON.parse(localStorage.getItem(attrKey) || "{}");
        attr[testId] = { variant: group, session_id: sessionId, store_id: storeId };
        localStorage.setItem(attrKey, JSON.stringify(attr));
      } catch(e) {}

    })
    .catch(function(err) { console.error("[A/B Tests] Init error:", err); });
})();
