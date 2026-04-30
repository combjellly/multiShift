import * as Blockly from 'blockly';

export const blocks = Blockly.common.createBlockDefinitionsFromJsonArray(
[{
  "type": "every",
  "message0": "every %1 %2",
  "args0": [
    {
      "type": "input_value",
      "name": "loopNumber"
    },
    {
      "type": "input_statement",
      "name": "listOfActions"
    }
  ],
  "inputsInline": false,
  "colour": 230,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "play",
  "message0": "play %1 %2",
  "args0": [
    {
      "type": "input_value",
      "name": "PLAY"
    },
    {
      "type": "input_statement",
      "name": "playAttributes"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 100,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "note",
  "message0": "note %1",
  "args0": [
    {
      "type": "input_value",
      "name": "NOTE"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 10,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "volume",
  "message0": "volume %1",
  "args0": [
    {
      "type": "input_value",
      "name": "VOLUME"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 10,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "pan",
  "message0": "pan %1",
  "args0": [
    {
      "type": "input_value",
      "name": "PAN"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 10,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "cut",
  "message0": "cut %1",
  "args0": [
    {
      "type": "input_value",
      "name": "CUT"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 10,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "num",
  "message0": "%1",
  "args0": [
    {
      "type": "field_input",
      "name": "NUM",
      "text": "dog"
    }
  ],
  "inputsInline": false,
  "output": null,
  "colour": 180,
  "tooltip": "",
  "helpUrl": ""
},
{
  "type": "if",
  "message0": "If %1 Do %2",
  "args0": [
    {
      "type": "input_value",
      "name": "CONDITION"
    },
    {
      "type": "input_statement",
      "name": "RESULT"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 230,
  "tooltip": "",
  "helpUrl": ""
},{
  "type": "compareif",
  "message0": "%1 %2 %3 %4",
  "args0": [
    {
      "type": "input_value",
      "name": "LEFT",
    },
    {
      "type": "field_dropdown",
      "name": "COMPARISON",
      "options": [
        [
          "==",
          "=="
        ],
        [
          "<",
          "<"
        ],
        [
          ">",
          ">"
        ],
        [
          "<=",
          "<="
        ],
        [
          ">=",
          ">="
        ],
        [
          "!=",
          "!="
        ]
      ]
    },
    {
      "type": "input_value",
      "name": "RIGHT"
    },
    {
      "type": "input_dummy"
    },
 ],
  "output": null,
  "colour": 230,
  "tooltip": "",
  "helpUrl": ""
},
{

  "type": "arithmatic",
  "message0": "%1 %2 %3 %4",
  "args0": [
    {
      "type": "input_value",
      "name": "A",
    },
    {
      "type": "field_dropdown",
      "name": "OPERATOR",
      "options": [
        [
          "+",
          "+"
        ],
        [
          "-",
          "-"
        ],
        [
          "x",
          "*"
        ],
        [
          "%",
          "/"
        ]
        
      ]
    },
    {
      "type": "input_value",
      "name": "B"
    },
    {
      "type": "input_dummy"
    }
  ],
  "output": "num",
  "colour": 230,
  "tooltip": "",
  "helpUrl": ""
},
{

  "type": "declare",
  "message0": "Make %1 = %2 %3",
  "args0": [
    {
      "type": "input_value",
      "name": "A",
    },
    {
      "type": "input_value",
      "name": "B"
    },
    {
      "type": "input_dummy"
    }
  ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 230,
  "tooltip": "",
  "helpUrl": ""
},

{

  "type": "retrieve",
  "message0": "Retrieve %1 position from %2 %3",
  "args0": [
    {
      "type": "input_value",
      "name": "INDEX",
    },
    {
      "type": "input_value",
      "name": "LIST"
    },
    {
      "type": "input_dummy"
    }
  ],
  "output": "num",
  "colour": 230,
  "tooltip": "",
  "helpUrl": ""
},


]

);