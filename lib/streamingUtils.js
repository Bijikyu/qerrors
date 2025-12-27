/**
 * Scalable Streaming Utilities
 * 
 * Provides memory-efficient streaming operations for large data processing
 * with backpressure management and chunking optimizations.
 */

const fs = require('fs');
const stream = require('stream');
const qerrors = require('./qerrors');

/**
 * Memory-bounded array processor for scalability
 */
class BoundedArrayProcessor {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.items = [];
  }

  add(item) {
    if (this.items.length >= this.maxSize) {
      // Remove oldest items to maintain memory bounds
      this.items.splice(0, this.items.length - this.maxSize + 1);
    }
    this.items.push(item);
  }

  clear() {
    this.items.length = 0; // More efficient than creating new array
  }

  size() {
    return this.items.length;
  }

  getItems() {
    return [...this.items]; // Return copy to prevent external modification
  }
}

/**
 * Configurable chunked stream processor for large data
 */
class ChunkedStreamProcessor extends stream.Transform {
  constructor(options = {}) {
    super({ objectMode: true });
    this.chunkSize = options.chunkSize || 1000;
    this.maxChunks = options.maxChunks || 100;
    this.currentChunk = [];
    this.chunkCount = 0;
    this.memoryBound = options.memoryBound || 10000; // Max items in memory
  }

  _transform(data, encoding, callback) {
    this.currentChunk.push(data);

    // Process chunk when it reaches configured size
    if (this.currentChunk.length >= this.chunkSize) {
      this.processChunk();
    }

    // Memory management - prevent unbounded growth
    if (this.chunkCount >= this.maxChunks || this.currentChunk.length > this.memoryBound) {
      return callback(new Error('Memory limit exceeded in stream processor'));
    }

    callback();
  }

  _flush(callback) {
    // Process any remaining data
    if (this.currentChunk.length > 0) {
      this.processChunk();
    }
    callback();
  }

  processChunk() {
    if (this.currentChunk.length === 0) return;

    const chunk = this.currentChunk.splice(0, this.currentChunk.length);
    this.chunkCount++;

    this.push({
      data: chunk,
      chunkId: this.chunkCount,
      timestamp: Date.now()
    });
  }
}

/**
 * Memory-efficient JSON stream parser
 */
class JSONStreamProcessor extends stream.Transform {
  constructor(options = {}) {
    super({ objectMode: true });
    this.maxObjectSize = options.maxObjectSize || 1024 * 1024; // 1MB max
    this.buffer = '';
    this.objectCount = 0;
    this.maxObjects = options.maxObjects || 10000;
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();

    // Process complete JSON objects
    let processed = 0;
    while (this.buffer.length > 0) {
      const objEnd = this.findObjectEnd();
      
      if (objEnd === -1) break; // Incomplete object

      const jsonString = this.buffer.substring(0, objEnd + 1);
      this.buffer = this.buffer.substring(objEnd + 1);

      // Validate object size to prevent memory issues
      if (jsonString.length > this.maxObjectSize) {
        return callback(new Error('JSON object too large'));
      }

      try {
        const parsed = JSON.parse(jsonString);
        this.push(parsed);
        processed++;
        this.objectCount++;

        // Check memory limits
        if (this.objectCount >= this.maxObjects) {
          return callback(new Error('Too many JSON objects'));
        }
      } catch (error) {
        return callback(new Error(`Invalid JSON: ${error.message}`));
      }
    }

    callback();
  }

  findObjectEnd() {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1; // No complete object found
  }
}

/**
 * Scalable file reader with memory management
 */
class ScalableFileReader {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.chunkSize = options.chunkSize || 64 * 1024; // 64KB chunks
    this.maxMemoryUsage = options.maxMemoryUsage || 10 * 1024 * 1024; // 10MB
    this.currentMemoryUsage = 0;
  }

  async *readChunks() {
    let fd;
    
    try {
      fd = await fs.promises.open(this.filePath, 'r');
      
      let position = 0;
      
      while (true) {
        // Check memory usage before reading
        if (this.currentMemoryUsage > this.maxMemoryUsage) {
          const error = new Error('Memory usage limit exceeded');
          try {
            await qerrors(error, 'streamingUtils.ScalableFileReader.readChunks', {
              operation: 'file_chunk_reading',
              filePath: this.filePath,
              currentMemoryUsage: this.currentMemoryUsage,
              maxMemoryUsage: this.maxMemoryUsage,
              position
            });
          } catch (qerror) {
            console.error('qerrors logging failed in readChunks', qerror);
          }
          throw error;
        }

        const { buffer } = await fd.read({
          buffer: Buffer.allocUnsafe(this.chunkSize),
          position,
          length: this.chunkSize
        });

        if (buffer.length === 0) break;

        this.currentMemoryUsage += buffer.length;
        position += buffer.length;

        yield buffer;

        // Free memory reference
        this.currentMemoryUsage -= buffer.length;
      }
    } catch (error) {
      // Use qerrors for sophisticated error reporting
      try {
        await qerrors(error, 'streamingUtils.ScalableFileReader.readChunks', {
          operation: 'file_chunk_reading',
          filePath: this.filePath,
          chunkSize: this.chunkSize,
          position: position || 0
        });
      } catch (qerror) {
        console.error('qerrors logging failed in readChunks', qerror);
      }
      
      throw error;
    } finally {
      if (fd) {
        try {
          await fd.close();
        } catch (closeError) {
          try {
            await qerrors(closeError, 'streamingUtils.ScalableFileReader.readChunks.close', {
              operation: 'file_descriptor_close',
              filePath: this.filePath
            });
          } catch (qerror) {
            console.error('qerrors logging failed in readChunks close', qerror);
          }
        }
      }
    }
  }

  createReadStream(options = {}) {
    const readStream = fs.createReadStream(this.filePath, {
      highWaterMark: this.chunkSize,
      ...options
    });

    // Add memory monitoring
    const originalRead = readStream._read.bind(readStream);
    readStream._read = function(size) {
      if (readStream.bytesRead > this.maxMemoryUsage) {
        return readStream.destroy(new Error('Memory usage limit exceeded'));
      }
      return originalRead(size);
    }.bind({ maxMemoryUsage: this.maxMemoryUsage });

    return readStream;
  }
}

module.exports = {
  BoundedArrayProcessor,
  ChunkedStreamProcessor,
  JSONStreamProcessor,
  ScalableFileReader
};