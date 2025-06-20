document.addEventListener("DOMContentLoaded", () => {
  // トグルボタンで対象を開閉
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.toggle("open");
    });
  });

  // 最新年を自動で開く
  const firstYearBtn = document.querySelector(".year-block .toggle-btn");
  if (firstYearBtn) firstYearBtn.click();

  // 最新年内の最新月を自動で開く
  const firstMonthBtn = document.querySelector(".year-block .month-block .toggle-btn");
  if (firstMonthBtn) firstMonthBtn.click();
});
