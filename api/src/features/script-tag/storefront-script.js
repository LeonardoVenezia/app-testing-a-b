(function() {
  console.log("[A/B Tests] Tiendanube ScriptTag Loaded");
  
  // 1. Fetch the active test config for this store
  // Tiendanube injects `LS.store` in the window object.
  let storeId = null;
  if (window.LS && window.LS.store) {
    storeId = typeof window.LS.store === 'object' ? window.LS.store.id : window.LS.store;
  }
  
  console.log("[A/B Tests] Detected Store ID:", storeId);

  if (!storeId) {
    console.warn("[A/B Tests] Could not find Store ID in window.LS.store");
    return;
  }

  // Tiendanube also injects `LS.product` if the user is currently on a product page.
  const currentProductId = window.LS && window.LS.product ? window.LS.product.id : null;

  // We can deduce the backend URL using the script's origin
  let backendUrl = "";
  try {
    const scriptTag = document.currentScript;
    if (scriptTag && scriptTag.src) {
      const url = new URL(scriptTag.src);
      backendUrl = url.origin;
    }
  } catch(e) {
    console.error("[A/B Tests] Could not parse backend URL", e);
    return;
  }

  // Fallback to the domain currently running if something weird happened with the URL
  if (!backendUrl) {
    backendUrl = "https://back.leovenezia.dev"; // from the user's latest logs, we know this is their ngrok/proxy!
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
  }

  // Fetch configs
  fetch(`${backendUrl}/script-tag/config/${storeId}`)
    .then(res => res.json())
    .then(tests => {
       if (!tests || tests.length === 0) return;

       // Group assignment per test
       const groups = {};
       tests.forEach(test => {
         const cookieName = `ab_test_group_${test.id}`;
         let g = getCookie(cookieName);
         if (!g) {
           g = Math.random() < 0.5 ? "A" : "B";
           setCookie(cookieName, g, 30); // 30 day cookie
         }
         groups[test.id] = g;
       });

       // Group enforcement dynamically based on product URLs
       if (currentProductId) {
         for (let test of tests) {
           let g = groups[test.id];
           if (currentProductId == test.variant_product_id && g === "A") {
             groups[test.id] = "B";
             setCookie(`ab_test_group_${test.id}`, "B", 30);
           } else if (currentProductId == test.original_product_id && g === "B") {
             groups[test.id] = "A";
             setCookie(`ab_test_group_${test.id}`, "A", 30);
           }
         }
       }

       // Inject noindex for variant product pages
       if (currentProductId) {
         const isVariant = tests.some(t => t.variant_product_id == currentProductId);
         if (isVariant) {
           const meta = document.createElement("meta");
           meta.name = "robots";
           meta.content = "noindex";
           document.head.appendChild(meta);
           console.log("[A/B Tests] SEO protected - noindex applied");
         }
       }

       // Hide the product we don't want them to see on product lists, sliders, home page...
       const hiddenProductIds = tests.map(test => {
         const g = groups[test.id];
         return g === "A" ? test.variant_product_id : test.original_product_id;
       });

       // Layer A: CSS attribute selectors (Immediate)
       const hideStyles = hiddenProductIds.map(id => {
         return `[data-product="${id}"], [data-product-id="${id}"], .product-item[data-product-id="${id}"] { display: none !important; }`;
       }).join("\n");
       
       const style = document.createElement("style");
       style.innerHTML = hideStyles;
       document.head.appendChild(style);

       // Layer B: URL sniffing via MutationObserver (Heuristic fallback)
       const observer = new MutationObserver(() => {
          hiddenProductIds.forEach(id => {
             document.querySelectorAll(`a[href*="-${id}-"]:not([data-ab-checked])`).forEach(a => {
                a.setAttribute("data-ab-checked", "true");
                const container = a.closest('.item, .product, .item-product, .js-item-product, article');
                if (container) {
                  container.style.display = 'none';
                }
             });
          });
       });
       observer.observe(document.body, { childList: true, subtree: true });

       // Run cleanup once on load
       hiddenProductIds.forEach(id => {
         document.querySelectorAll(`a[href*="-${id}-"]:not([data-ab-checked])`).forEach(a => {
            a.setAttribute("data-ab-checked", "true");
            const container = a.closest('.item, .product, .item-product, .js-item-product, article');
            if (container) container.style.display = 'none';
         });
       });

       // Log view if on product page
       if (currentProductId) {
         const activeTest = tests.find(t => t.original_product_id == currentProductId || t.variant_product_id == currentProductId);
         if (activeTest) {
            // Check session storage to avoid spamming views from same session reload
            const viewKey = `ab_test_view_${activeTest.id}`;
            if (!sessionStorage.getItem(viewKey)) {
              sessionStorage.setItem(viewKey, "true");
              fetch(`${backendUrl}/script-tag/config/${storeId}/log-view`, {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ test_id: activeTest.id, group: groups[activeTest.id] })
              }).catch(err => console.error("[A/B Tests] Could not log view", err));
            }
         }
       }
    })
    .catch(err => console.error("[A/B Tests] Initialization error:", err));
})();
