import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the VARify upload experience", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "VARify" })).toBeInTheDocument();
    expect(screen.getByText("AI Referee Assistant for Card Decisions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze Clip" })).toBeInTheDocument();
  });

  it("uploads selected clip as multipart form data and renders analysis", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          decision: "RED_CARD",
          confidence: 92,
          keyTimestamp: "00:04-00:07",
          explanation: "Studs-up challenge with excessive force.",
          evidence: [
            { timestamp: "00:04", description: "High contact point" },
            { timestamp: "00:07", description: "No realistic play on ball" }
          ],
          ruleCategory: "excessive force",
          geminiSummary: "Serious foul play likely.",
          modelTrace: {
            videoAnalyzer: "Gemini",
            orchestrator: "RocketRide",
            decisionModel: "Gemma on GMI Cloud"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<App />);

    const clip = new File(["clip"], "tackle.webm", { type: "video/webm" });
    await userEvent.upload(screen.getByLabelText("Upload soccer clip"), clip);
    await userEvent.click(screen.getByRole("button", { name: "Analyze Clip" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analyze");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("video")).toBe(clip);

    expect(await screen.findByText("Red Card")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("00:04-00:07")).toBeInTheDocument();
    expect(screen.getByText("High contact point")).toBeInTheDocument();
    expect(screen.getByText("Serious foul play likely.")).toBeInTheDocument();
    expect(screen.getByText("Model trace")).toBeInTheDocument();
  });
});
