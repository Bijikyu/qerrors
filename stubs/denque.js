// simple queue stub emulating denque behavior for tests
class Denque {
  constructor(){ this.items = []; } //initialize empty queue
  push(val){ this.items.push(val); } //add item to end
  shift(){ return this.items.shift(); } //remove item from front
  get length(){ return this.items.length; } //queue size
}
module.exports = Denque; //export stub class
