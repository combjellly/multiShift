/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/*
This toolbox contains nearly every single built-in block that Blockly offers,
in addition to the custom block 'add_text' this sample app adds.
You probably don't need every single block, and should consider either rewriting
your toolbox from scratch, or carefully choosing whether you need each block
listed here.
*/

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
    kind:'category',
    name: 'Shift',
    categorystyle: 'logic_category',
    contents:
    [
    {
      'kind': 'block',
      'type': 'every'
    },
    {
      'kind': 'block',
      'type': 'play'
    },
    {
      'kind': 'block',
      'type': 'note'
    },
    {
      'kind': 'block',
      'type': 'volume'
    },
    {
      'kind': 'block',
      'type': 'pan'
    },
    {
      'kind': 'block',
      'type': 'cut'
    },
    {
      'kind': 'block',
      'type': 'num'
    },
    {
      'kind': 'block',
      'type': 'dynamic_list_create'
    },
    {
      'kind': 'block',
      'type': 'retrieve'
    },
  ],
  },
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [
        {
          kind: 'block',
          type: 'if',
        },
        {
          kind: 'block',
          type: 'compareif',
        },
      ],
    },

    {
      kind: 'category',
      name: 'Math',
      categorystyle: 'math_category',
      contents: [

        {
          kind: 'block',
          type: 'arithmatic',
        },
        {
          kind: 'block',
          type: 'declare',
        },
        {
          kind: 'block',
          type: 'math_random_int',
          inputs: {
            FROM: {
              shadow: {
                type: 'math_number',
                fields: {
                  NUM: 1,
                },
              },
            },
            TO: {
              shadow: {
                type: 'math_number',
                fields: {
                  NUM: 100,
                },
              },
            },
          },
        },
      ],
    },

    {
      kind: 'category',
      name: 'Variables',
      categorystyle: 'variable_category',
      custom: 'VARIABLE',
    },
    {
      kind: 'category',
      name: 'Functions',
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE',
    },
  ],
};
