import React from 'react';
import ReactDOM from 'react-dom/client'; // or 'react-dom' if using React 17
import './index.css'; // Import your CSS file
import AudioEngine from './language/AudioEngine';
import * as Blockly from 'blockly';
import { forBlock } from './generators/javascript';
import { shiftGenerator } from './generators/shiftBlock';
import { blocks } from './blocks/shiftBlock';
import { save, load } from './serialization';
import { toolbox } from './toolbox';
import { Helmet } from 'react-helmet';
import OutputPanel from './UI/OutputPanel';
import * as BlockDynamicConnection from '@blockly/block-dynamic-connection';

// Register the blocks and generator with Blockly
Blockly.common.defineBlocks(blocks);
Object.assign(shiftGenerator.forBlock, forBlock);

// Set up UI elements and inject Blockly
const blocklyDiv = document.getElementById('blocklyDiv');

const ws = Blockly.inject(blocklyDiv, {
    toolbox: toolbox,
    plugins: {
        connectionPreviewer: BlockDynamicConnection.decoratePreviewer(
            // Replace with a custom connection previewer, or remove to decorate
            // the default one.
            Blockly.InsertionMarkerPreviewer
        ),
    },
});

// This function resets the code and output divs, shows the
// generated code from the workspace, and evals the code.
// In a real application, you probably shouldn't use `eval`.
const runCode = () => {
  const code = shiftGenerator.workspaceToCode(ws);
  document.getElementById('generatedCodeDisplay').innerText = code;
  document.getElementById('generatedCodeDummy').innerText = code;

  document.getElementById('output').innerHTML = '';
  return code;
};

// Load the initial state from storage and run the code.
load(ws);

// Every time the workspace changes state, save the changes to storage.
ws.addChangeListener((e) => {
  if (e.isUiEvent) return;
  save(ws);
});

ws.addChangeListener(BlockDynamicConnection.finalizeConnections);


// Whenever the workspace changes meaningfully, run the code again.
ws.addChangeListener((e) => {
  if (
    e.isUiEvent ||
    e.type === Blockly.Events.FINISHED_LOADING ||
    ws.isDragging()
  ) {
    return;
  }
  runCode();
});



const App = () => (
  <>
   <AudioEngine/>
   <OutputPanel/>
  </>
);

const root = ReactDOM.createRoot(document.getElementById('react-root')); // For React 18
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
