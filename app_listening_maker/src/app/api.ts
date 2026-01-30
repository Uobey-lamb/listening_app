// app/api.ts
export const API_BASE = "http://localhost:8000";

export async function fetchProblem() {
  const res = await fetch(`${API_BASE}/problem`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch problem");
  }

  return res.json();
}

export async function createProblem() {
  const res = await fetch(`${API_BASE}/problem/generate`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error("failed to create problem");
  }

  return res.json();
}