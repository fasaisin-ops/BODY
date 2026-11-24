/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + กรองตาม mood
   - order.html   : เติมฟอร์มจาก URL และส่งออเดอร์
   - admin.html   : แสดงออเดอร์จาก Google Sheet (CSV)
   ทำงานตาม element ที่พบในหน้า จึงใส่ไฟล์นี้ไฟล์เดียวได้ทุกหน้า
   ========================================================== */

(function () {
  "use strict";

  /* ---------- ค่าคงที่ ---------- */
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbxmZdsJ-ll23BMqmujKACNvD4B87kb2En60QMoX7tLNjCBIRvo5DQkN2mNu6jvB0KNytA/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_QY0ThDQPa1T6vGPh8EiySHe5YCajyicOxQhm_Ut4s_8oV-1hbO5gpQmgIMWfcphMoTHqFfQj8Uzr/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  /* ---------- ตัวช่วยทั่วไป ---------- */

  // สร้าง element แบบปลอดภัย (ใช้ textContent ไม่ใช้ innerHTML กัน XSS)
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        if (key === "className") node.className = props[key];
        else if (key === "text") node.textContent = props[key];
        else node.setAttribute(key, props[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function formatPrice(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("th-TH");
  }

  /* ==========================================================
     1) หน้า product.html
     ========================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = "all";

    function isValidMood(mood) {
      return MOODS.some(function (m) {
        return m.key === mood;
      });
    }

    function buildFilterBar() {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = el("button", { type: "button", "data-mood": m.key });
        if (m.key !== "all") {
          btn.className = "mood-" + m.key;
          btn.appendChild(el("span", { className: "mood-dot", "aria-hidden": "true" }));
        }
        btn.appendChild(document.createTextNode(m.label));
        btn.addEventListener("click", function () {
          applyFilter(m.key, true);
        });
        filterBar.appendChild(btn);
      });
    }

    function updateActiveButton() {
      var buttons = filterBar.querySelectorAll("button");
      Array.prototype.forEach.call(buttons, function (btn) {
        var active = btn.getAttribute("data-mood") === currentMood;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function buildCard(p) {
      var fullName = p.name + " " + p.size;
      var orderUrl =
        "order.html?item=" +
        encodeURIComponent(fullName) +
        "&price=" +
        encodeURIComponent(p.price);

      var thumb = el("div", { className: "thumb" }, [
        el("img", { src: p.image, alt: p.name, loading: "lazy" })
      ]);

      var moodLabel = el("div", { className: "mood-label" }, [
        el("span", { className: "mood-dot", "aria-hidden": "true" }),
        el("span", { text: p.mood.charAt(0).toUpperCase() + p.mood.slice(1) })
      ]);

      var meta = el("div", { className: "meta" }, [
        el("span", { className: "size", text: p.size }),
        el("span", { className: "price" }, [
          document.createTextNode(formatPrice(p.price)),
          el("small", { text: "บาท" })
        ])
      ]);

      var buy = el("a", { className: "btn btn-accent", href: orderUrl, text: "สั่งซื้อ" });

      var body = el("div", { className: "body" }, [
        moodLabel,
        el("h3", { text: p.name }),
        meta,
        buy
      ]);

      return el("article", { className: "product-card mood-" + p.mood }, [thumb, body]);
    }

    function render() {
      list.textContent = "";
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (shown.length === 0) {
        list.appendChild(el("p", { className: "text-muted", text: "ไม่พบสินค้าในหมวดนี้" }));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function applyFilter(mood, updateUrl) {
      currentMood = isValidMood(mood) ? mood : "all";
      updateActiveButton();
      render();

      if (updateUrl && window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        if (currentMood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", currentMood);
        window.history.replaceState(null, "", url.toString());
      }
    }

    buildFilterBar();

    var initialMood = (new URLSearchParams(window.location.search).get("mood") || "").toLowerCase();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("โหลด products.json ไม่สำเร็จ (" + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        products = data;
        applyFilter(initialMood, false);
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = "";
        list.appendChild(
          el("p", { className: "text-muted", text: "ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง" })
        );
      });
  }

  /* ==========================================================
     2) หน้า order.html
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // เติมค่าจาก URL ทันทีที่โหลดหน้า (ทั้ง items และ total)
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");

    if (itemsInput && item !== null) itemsInput.value = item;
    if (totalInput && price !== null) totalInput.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      function val(id) {
        var node = document.getElementById(id);
        return node ? node.value.trim() : "";
      }

      var payload = {
        customerName: val("customerName"),
        contact: val("contact"),
        items: val("items"),
        total: val("total"),
        note: val("note")
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = "thankyou.html";
        })
        .catch(function (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) หน้า admin.html
     ========================================================== */

  // parse CSV เอง: รองรับ "ข้อความในเครื่องหมายคำพูด", "" แทน ", และขึ้นบรรทัดใหม่ในช่อง
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    // ตัด BOM ถ้ามี
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    // แถวสุดท้ายที่ไม่มีขึ้นบรรทัดใหม่ปิดท้าย
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่าง
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLUMNS = 6; // วันเวลา, ชื่อ, เบอร์/Line, รายการ, ยอดรวม, หมายเหตุ

    function showMessage(message) {
      tbody.textContent = "";
      var td = el("td", { colspan: String(COLUMNS), text: message });
      tbody.appendChild(el("tr", null, [td]));
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("โหลดข้อมูลออเดอร์ไม่สำเร็จ (" + res.status + ")");
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // ตัดแถวหัวตาราง

        if (rows.length === 0) {
          showMessage("ยังไม่มีออเดอร์");
          return;
        }

        // Sheet เพิ่มแถวใหม่ต่อท้ายเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < COLUMNS; i++) {
            var value = r[i] !== undefined ? r[i] : "";
            if (i === 4 && value !== "") value = formatPrice(value);
            tr.appendChild(el("td", { text: value }));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- เริ่มทำงานเมื่อ DOM พร้อม ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
