import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the VARify upload experience", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "VARify" })).toBeInTheDocument();
    expect(screen.getByText("AI Referee Assistant for Card Decisions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze Clips" })).toBeInTheDocument();
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
            decisionModel: "Gemma on GMI Cloud"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<App />);

    const clip = new File(["clip"], "tackle.webm", { type: "video/webm" });
    await userEvent.upload(screen.getByLabelText("Upload soccer clip"), clip);
    await userEvent.click(screen.getByRole("button", { name: "Analyze Clips" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analyze");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("omit");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("video")).toBe(clip);
    expect((init?.body as FormData).getAll("video")).toHaveLength(1);

    expect(await screen.findByText("Red Card")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("00:04-00:07")).toBeInTheDocument();
    expect(screen.getByText("High contact point")).toBeInTheDocument();
    expect(screen.getByText("Serious foul play likely.")).toBeInTheDocument();
    expect(screen.getByText("Model trace")).toBeInTheDocument();
  });

  it("uploads multiple clips and seeks the matching preview when a timestamp is clicked", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          decision: "YELLOW_CARD",
          confidence: 82,
          keyTimestamp: "Video 1 - 00:07-00:09",
          keyTimestamps: ["Video 1 - 00:07-00:09", "Video 2 - 00:00"],
          keyMoments: [
            { timestamp: "00:07", timestampSeconds: 7, videoIndex: 1, videoLabel: "Video 1" },
            { timestamp: "00:00", timestampSeconds: 11, videoIndex: 2, videoLabel: "Video 2" }
          ],
          explanation: "Multiple angles show the same reckless contact.",
          evidence: [
            {
              timestamp: "00:00",
              timestampSeconds: 11,
              description: "Reverse angle shows the point of contact.",
              videoIndex: 2,
              videoLabel: "Video 2"
            }
          ],
          ruleCategory: "reckless"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<App />);

    const wideAngle = new File(["wide"], "wide-angle.mp4", { type: "video/mp4" });
    const closeAngle = new File(["close"], "close-angle.mp4", { type: "video/mp4" });
    await userEvent.upload(screen.getByLabelText("Upload soccer clip"), [wideAngle, closeAngle]);
    await userEvent.click(screen.getByRole("button", { name: "Analyze Clips" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.body as FormData).getAll("video")).toEqual([wideAngle, closeAngle]);

    const previews = document.querySelectorAll("video");
    expect(previews).toHaveLength(2);

    const videoTwoTimestampButtons = await screen.findAllByRole("button", { name: "Video 2 - 00:00" });
    await userEvent.click(videoTwoTimestampButtons[0]);

    expect((previews[1] as HTMLVideoElement).currentTime).toBe(11);
    expect(screen.getByText("Video 2: close-angle.mp4")).toBeInTheDocument();
  });
});
