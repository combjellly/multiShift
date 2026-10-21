module Test.Main where

import Prelude

import Effect (Effect)
import Effect.Class.Console (log)
import Parsing (runParser)
import Parser (program)
import Data.Either (Either(..))

main :: Effect Unit
main = do
  log "Running Chop Tests:"
  testParse "every 1\n  play.amen:0[100,0,50,1] chop.[16,4]"
  testParse "every 0.25\n  p = 2\n  play.sampleName:sample[a,p,p,c] chop.[16, p]"
  testParse "every 0.5\n  play.amen chop.[4,0]"
  testParse "every 1\n  play.amen:0[80]"
  testParse "every 1\n  if x == 1 [ play.amen:0[80,0,50,0] chop.[8,2] ]"

testParse :: String -> Effect Unit
testParse code = do
  case runParser code program of
    Left err -> log $ "FAIL: " <> code <> "\n  Error: " <> show err
    Right p -> log $ "PASS: " <> code <> " =>\n  " <> show p
