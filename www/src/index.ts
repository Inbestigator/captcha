interface Stats {
  challenges: number;
  checks: number;
  fails: number;
}

const { format } = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

async function fetchStats(): Promise<void> {
  const statsContainer = document.querySelector(".stats");

  if (!statsContainer) return;

  try {
    const response = await fetch("/api/stats");

    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.status}`);
    }

    const stats = (await response.json()) as Stats;
    const values = statsContainer.querySelectorAll("strong");

    if (values.length >= 3) {
      values[0].textContent = format(stats.checks);
      values[1].textContent = format(stats.fails);
      values[2].textContent = format(stats.challenges);

      for (const value of values) value.classList.remove("loading");
    }
  } catch (error) {
    console.error("Failed to load stats:", error);
  }
}

fetchStats();
