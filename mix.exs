defmodule KinoLiveAudio.MixProject do
  use Mix.Project

  def project do
    [
      app: :kino_live_audio,
      version: "0.2.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      description:
        "A Kino designed to record a raw audio stream (no client-side encoding) and emit events.",
      source_url: "https://github.com/acalejos/kino_live_audio",
      package: package(),
      docs: docs()
    ]
  end

  def cli do
    [preferred_envs: [docs: :docs, "hex.publish": :docs]]
  end

  def application do
    []
  end

  defp package do
    [
      maintainers: ["Andres Alejos"],
      licenses: ["MIT"],
      links: %{"GitHub" => "https://github.com/acalejos/kino_live_audio"}
    ]
  end

  defp deps do
    [
      {:kino, "~> 0.18"},
      {:ex_doc, ">= 0.0.0", only: :docs, runtime: false}
    ]
  end

  defp docs do
    [
      main: "KinoLiveAudio",
      extras: [
        "notebooks/vad.livemd"
      ],
      groups_for_extras: [
        Notebooks: Path.wildcard("notebooks/*.livemd")
      ]
    ]
  end

  defp aliases do
    [
      build: ["cmd scripts/build.sh"]
    ]
  end
end
