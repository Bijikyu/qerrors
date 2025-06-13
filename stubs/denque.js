// minimal denque stub providing queue methods for tests
class Denque {
  constructor(){ this.items = []; }
  push(val){ this.items.push(val); } //add item to end
  shift(){ return this.items.shift(); } //remove item from front
  get length(){ return this.items.length; } //queue size
}
module.exports = Denque; //export stub class
