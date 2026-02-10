defmodule KinoLiveAudio do
  @moduledoc """
  A Kino designed to record a raw audio stream (no client-side encoding) and emit events.

  When you consume the events, you can directly convert the audio to an `Nx` tensor.

  You may specify the sample rate of the audio and the frequency that events should be emmitted
  by specifying how many samples should accumulate before sending to the server.

  Refer to the sample [Livebook](notebooks/vad.livemd) for usage.
  """
  use Kino.JS, assets_path: "lib/assets/live_audio/build"
  use Kino.JS.Live

  @type t :: Kino.JS.Live.t()

  @doc """
  Creates a new `KinoLiveAudio`

  The recorder captures raw PCM audio data (32-bit float samples) from the
  browser's microphone using the Web Audio API.

  ## Options

  * `:chunk_size` - Wait for this many samples before sending. Will send exactly this amount to the
      emmited event. Must be a positive integer. Defaults to 16_000.
  * `:sample_rate` - The sample rate of the audio stream. Defaults to 16_000.
  * `:unit` - The unit for the `:chunk_size` option. Can be any of the following:
    * `:samples` - Directly passes the `:chunk_size` parameter
    * `:s` - Seconds of audio before sending, according to the sample rate
    * `:ms` - Miliseconds of audio before sending, according to the sample rate
    * `:mu` - Microseconds of audio before sending, according to the sample rate
  """
  @spec new(keyword()) :: t()
  def new(opts \\ []) do
    {chunk_size, sample_rate} = process_inputs!(opts)

    Kino.JS.Live.new(__MODULE__, %{
      sample_rate: sample_rate,
      chunk_size: chunk_size
    })
  end

  defp process_inputs!(opts) do
    %{chunk_size: chunk_size, sample_rate: sample_rate, unit: unit} =
      Keyword.validate!(opts, chunk_size: 16_000, sample_rate: 16_000, unit: :samples)
      |> Map.new()

    if not is_integer(sample_rate) or sample_rate <= 0 do
      raise(ArgumentError, "Sample rate must be a positive integer, got #{inspect(sample_rate)}")
    end

    if not is_integer(chunk_size) or chunk_size <= 0 do
      raise(ArgumentError, "Chunk size must be a positive integer, got #{inspect(chunk_size)}")
    end

    chunk_size =
      case unit do
        :samples ->
          chunk_size

        :s ->
          trunc(sample_rate * chunk_size)

        :ms ->
          trunc(sample_rate * chunk_size / 1_000)

        :mu ->
          trunc(sample_rate * chunk_size / 1_000_000)

        _ ->
          raise ArgumentError,
                ":unit opt must be in [:s, :ms, :ms or :samples, got: #{inspect(unit)}"
      end

    {chunk_size, sample_rate}
  end

  @doc """
  Reads the recorded audio data.

  Returns the audio binary data or `nil` if no recording has been made.

  ## Examples

      recorder = KinoLiveAudio.new()
      # ... user records audio ...
      audio_data = KinoLiveAudio.read(recorder)

  """
  @spec read(t()) :: binary() | nil
  def read(kino) do
    Kino.JS.Live.call(kino, :read)
  end

  @doc """
  This allows programmatic control of recording.

  ## Examples

      recorder = KinoLiveAudio.new()
      KinoLiveAudio.start_recording(recorder)

  """
  @spec start_recording(t()) :: :ok
  def start_recording(kino) do
    Kino.JS.Live.cast(kino, :start_recording)
  end

  @doc """
  This allows programmatic control of recording.

  ## Examples

      recorder = KinoLiveAudio.new()
      KinoLiveAudio.stop_recording(recorder)

  """
  @spec stop_recording(t()) :: :ok
  def stop_recording(kino) do
    Kino.JS.Live.cast(kino, :stop_recording)
  end

  @doc """
  Clears the recorded audio data.

  ## Examples

      recorder = KinoLiveAudio.new()
      KinoLiveAudio.clear(recorder)

  """
  @spec clear(t()) :: :ok
  def clear(kino) do
    Kino.JS.Live.cast(kino, :clear)
  end

  @impl true
  def init(config, ctx) do
    {:ok, assign(ctx, config)}
  end

  @impl true
  def handle_connect(ctx) do
    payload = %{
      sample_rate: ctx.assigns.sample_rate,
      chunk_size: ctx.assigns.chunk_size
    }

    {:ok, payload, ctx}
  end

  @impl true
  def handle_event("audio_chunk", {:binary, _info, binary}, ctx) do
    # Emit the audio chunk as an event for Kino.listen
    emit_event(ctx, %{event: :audio_chunk, chunk: binary})
    {:noreply, ctx}
  end

  @impl true
  def handle_cast(:start_recording, ctx) do
    broadcast_event(ctx, "start", %{})
    {:noreply, ctx}
  end

  def handle_cast(:stop_recording, ctx) do
    broadcast_event(ctx, "stop", %{})
    {:noreply, ctx}
  end
end
