module SynthEngine where

import Prelude (Unit)
import Effect (Effect)

foreign import data SynthEngine :: Type

-- Options could include { audioContext :: Foreign } or similar
foreign import newSynthEngine :: forall opts. Record opts -> Effect SynthEngine

foreign import initializeWebAudio :: SynthEngine -> Effect Unit

-- Record props include at least: { whenPosix :: Number, note :: Number, gain :: Number, duration :: Number, type :: String }
foreign import playSynth :: SynthEngine -> forall props. Record props -> Effect Unit
