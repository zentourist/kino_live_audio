defmodule KinoLiveAudioTest do
  use ExUnit.Case
  doctest KinoLiveAudio

  describe "new/1" do
    test "creates a KinoLiveAudio with default options" do
      audio = KinoLiveAudio.new()
      assert %Kino.JS.Live{} = audio
    end

    test "creates with custom sample rate" do
      audio = KinoLiveAudio.new(sample_rate: 48_000)
      assert %Kino.JS.Live{} = audio
    end

    test "creates with custom chunk size in samples" do
      audio = KinoLiveAudio.new(chunk_size: 8_000, unit: :samples)
      assert %Kino.JS.Live{} = audio
    end

    test "creates with chunk size in seconds" do
      audio = KinoLiveAudio.new(chunk_size: 2, unit: :s, sample_rate: 16_000)
      assert %Kino.JS.Live{} = audio
    end

    test "creates with chunk size in milliseconds" do
      audio = KinoLiveAudio.new(chunk_size: 500, unit: :ms, sample_rate: 16_000)
      assert %Kino.JS.Live{} = audio
    end

    test "creates with chunk size in microseconds" do
      audio = KinoLiveAudio.new(chunk_size: 500_000, unit: :mu, sample_rate: 16_000)
      assert %Kino.JS.Live{} = audio
    end

    test "raises error for negative sample rate" do
      assert_raise ArgumentError, ~r/Sample rate must be a positive integer/, fn ->
        KinoLiveAudio.new(sample_rate: -1)
      end
    end

    test "raises error for non-integer sample rate" do
      assert_raise ArgumentError, ~r/Sample rate must be a positive integer/, fn ->
        KinoLiveAudio.new(sample_rate: 16_000.5)
      end
    end

    test "raises error for invalid unit" do
      assert_raise ArgumentError, ~r/:unit opt must be in/, fn ->
        KinoLiveAudio.new(unit: :invalid)
      end
    end

    test "raises error for zero chunk size" do
      assert_raise ArgumentError, ~r/Chunk size must be a positive/, fn ->
        KinoLiveAudio.new(chunk_size: 0, unit: :samples)
      end
    end

    test "raises error for negative chunk size" do
      assert_raise ArgumentError, ~r/Chunk size must be a positive/, fn ->
        KinoLiveAudio.new(chunk_size: -100, unit: :samples)
      end
    end
  end
end
