(function() {
  console.log("[A/B Tests] Tiendanube ScriptTag Loaded");
  
  // 1. Fetch the active test config for this store
  // Tiendanube injects `LS.store` in the window object.
  const storeId = window.LS && window.LS.store ? window.LS.store : null;
  
  if (!storeId) {
    console.warn("[A/B Tests] Could not find Store ID in window.LS");
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

  // Group assignment: A = Original, B = Variant
  let group = getCookie("ab_test_group");
  if (!group) {
    group = Math.random() < 0.5 ? "A" : "B";
    setCookie("ab_test_group", group, 30); // 30 day cookie
  }

  // Fetch configs
  fetch(`${backendUrl}/script-tag/config/${storeId}`)
    .then(res => res.json())
    .then(tests => {
       if (!tests || tests.length === 0) return;

       // Group enforcement dynamically based on product URLs
       if (currentProductId) {
         for (let test of tests) {
           if (currentProductId == test.variant_product_id && group === "A") {
             group = "B";
             setCookie("ab_test_group", "B", 30);
           } else if (currentProductId == test.original_product_id && group === "B") {
             group = "A";
             setCookie("ab_test_group", "A", 30);
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
         return group === "A" ? test.variant_product_id : test.original_product_id;
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
                 body: JSON.stringify({ test_id: activeTest.id, group })
              }).catch(err => console.error("[A/B Tests] Could not log view", err));
            }
         }
       }
    })
    .catch(err => console.error("[A/B Tests] Initialization error:", err));
})();
