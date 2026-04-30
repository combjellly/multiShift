import * as Blockly from 'blockly';

export const shiftGenerator = new Blockly.Generator('SHIFT');

const Order = {
  ATOMIC: 0,
};


shiftGenerator.forBlock['every'] = function(block, generator) {
  const value = generator.valueToCode(block, 'loopNumber', Order.ATOMIC) || '0';
  let list_of_actions = generator.statementToCode(block, 'listOfActions');

  const code = `every ${value} \n ${list_of_actions}`;
  return code;
};


shiftGenerator.forBlock['play'] = function(block, generator) {
  note = 0;
  volume = 60;
  pan = 50;
  cut = 0;

  const sampleName = generator.valueToCode(
      block, 'PLAY', Order.ATOMIC);
  const playAttributes =
    generator.statementToCode(block, 'playAttributes');
  var playArray = [];
  var currentBlock = this.getInputTargetBlock('playAttributes');

  while (currentBlock) {


    try {
      var note = generator.valueToCode(currentBlock, 'NOTE', Order.ATOMIC);
    } catch (error) {
    }

    try {
      var volume = generator.valueToCode(currentBlock, 'VOLUME', Order.ATOMIC);
    } catch (error) {
    }

    try {
      var pan = generator.valueToCode(currentBlock, 'PAN', Order.ATOMIC);
    } catch (error) {
    }

    try {
      var cut = generator.valueToCode(currentBlock, 'CUT', Order.ATOMIC);
    } catch (error) {
    }

    playArray.push(currentBlock);
    currentBlock = currentBlock.getNextBlock();
}


  //console.log(note + volume);
  const code = `play.${sampleName}[ `+volume+', ' +note+', ' +pan+', ' +cut+']';

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }
};



shiftGenerator.forBlock['num'] = function(block) {
  const num = block.getFieldValue('NUM');
  const code = `${num}`;

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return [code,Order.ATOMIC];
  } else {
    // Return an empty string if the block is floating
    return '';
  }
};

shiftGenerator.forBlock['volume'] = function(block, generator) {
  // const name = block.getFieldValue('MEMBER_NAME');
  const value = generator.valueToCode(
      block, 'VOLUME', Order.ATOMIC);
  const code = `${value}`;

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }
};

shiftGenerator.forBlock['note'] = function(block, generator) {
  // const name = block.getFieldValue('MEMBER_NAME');
  const value = generator.valueToCode(
      block, 'NOTE', Order.ATOMIC);
  const code = `${value}`;

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }

};

shiftGenerator.forBlock['pan'] = function(block, generator) {
  // const name = block.getFieldValue('MEMBER_NAME');
  const value = generator.valueToCode(
      block, 'PAN', Order.ATOMIC);
  const code = `${value}`;

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }
};

shiftGenerator.forBlock['cut'] = function(block, generator) {
  // const name = block.getFieldValue('MEMBER_NAME');
  const value = generator.valueToCode(
      block, 'CUT', Order.ATOMIC);
  const code = `${value}`;
  return code;

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }
};

shiftGenerator.forBlock['if'] = function(block, generator) {
  const condition = generator.statementToCode(
        block, 'CONDITION', Order.ATOMIC);

  const result = generator.statementToCode(
        block, 'RESULT', Order.ATOMIC);

  const code = `if ${condition} [ ${result} ]`

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }

};

shiftGenerator.forBlock['compareif'] = function(block, generator) {
  const left = generator.valueToCode(
        block, 'LEFT', Order.ATOMIC) || 0;

  const comparison = block.getFieldValue('COMPARISON')

  const right = generator.valueToCode(
        block, 'RIGHT', Order.ATOMIC) || 0;

  const code = `${left} ${comparison} ${right}`

  if (this.getSurroundParent()) {
    // Generate code for this block if it has a surrounding block
    return code;
  } else {
    // Return an empty string if the block is floating
    return '';
  }
};

shiftGenerator.forBlock['arithmatic'] = function(block, generator) {
  const left = generator.valueToCode(block, 'A', Order.ATOMIC) || '0';
  const operator = block.getFieldValue('OPERATOR');
  const right = generator.valueToCode(block, 'B', Order.ATOMIC) || '0';

  const code = `${left} ${operator} ${right}`;

  if (this.getSurroundParent()) {
      // Generate code for this block if it has a surrounding block
      return [code, Order.ATOMIC];
    } else {
      // Return an empty string if the block is floating
      return '';
    }

};

shiftGenerator.forBlock['declare'] = function(block, generator) {
  const left = generator.valueToCode(block, 'A', Order.ATOMIC) || '0';
  const right = generator.valueToCode(block, 'B', Order.ATOMIC) || '0';

  const code = `${left} = ${right}`;

  return code;

};

shiftGenerator.forBlock['dynamic_list_create'] = function(block, generator) {
  const itemCount = block.itemCount || 1; // Adjust based on how itemCount is tracked
  const elements = [];

for (let i = 0; i < itemCount; i++) {
    const itemCode = generator.valueToCode(block, 'ADD' + i, Order.ATOMIC) || '0';
    elements.push(itemCode);
  }

  const code = `[ ${elements.join(' ')} ] `;

  return [code, Order.ATOMIC];

};

shiftGenerator.forBlock['retrieve'] = function(block, generator) {

  const index = generator.valueToCode(block, 'INDEX', Order.ATOMIC) || '0';
  const list = generator.valueToCode(block, 'LIST', Order.ATOMIC) || '0';
  const code = `${list}:${index}`;

  return [code, Order.ATOMIC];

};


shiftGenerator.scrub_ = function(block, code, thisOnly) {
  const nextBlock =
      block.nextConnection && block.nextConnection.targetBlock();
  if (nextBlock && !thisOnly) {
    return code + '\n ' + shiftGenerator.blockToCode(nextBlock);
  }
  return code;
};

