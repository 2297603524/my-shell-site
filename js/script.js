// ===== 空壳网站基础脚本 =====
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("demo-btn");

  if (btn) {
    btn.addEventListener("click", () => {
      alert("🎉 空壳网站运行正常！在这里开始你的创作吧。");
    });
  }

  // 平滑滚动（兼容锚点导航）
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
});
