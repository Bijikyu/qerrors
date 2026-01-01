'use strict';
/**
 * Memory-bounded circular buffer using denque module
 */
const qerrors=require('./qerrors');
class CircularBuffer{constructor(maxSize){const Denque=require('denque');this.maxSize=maxSize;this.buffer=new Denque();}push(item){try{this.buffer.length>=this.maxSize&&this.buffer.shift();this.buffer.push(item);}catch(error){setImmediate(()=>{qerrors(error,'memoryManagement.CircularBuffer.push',{maxSize:this.maxSize,currentCount:this.buffer.length,operation:'circular_buffer_push'}).catch(qerror=>{console.error('qerrors logging failed in CircularBuffer push',qerror);});});throw error;}}shift(){try{return this.buffer.shift();}catch(error){setImmediate(()=>{qerrors(error,'memoryManagement.CircularBuffer.shift',{maxSize:this.maxSize,currentCount:this.buffer.length,operation:'circular_buffer_shift'}).catch(qerror=>{console.error('qerrors logging failed in CircularBuffer shift',qerror);});});throw error;
        }
    }

    size() {
        return this.buffer.length;
    }

    isEmpty() {
        return this.buffer.length === 0;
    }

    isFull() {
        return this.buffer.length >= this.maxSize;
    }

    toArray() {
        return this.buffer.toArray();
    }

    clear() {
        this.buffer.clear();
    }
}

module.exports = {
    CircularBuffer,
    // Re-export shared implementations for convenience
    BoundedLRUCache: require('./shared/BoundedLRUCache'),
    BoundedQueue: require('./shared/BoundedQueue'),
    BoundedSet: require('./shared/BoundedSet'),
    MemoryMonitor: require('./memoryMonitor'),
    ObjectPool: require('./objectPool'),
    MemoryUtils: require('./memoryUtils'),
    BoundedEventEmitter: require('./boundedEventEmitter')
};