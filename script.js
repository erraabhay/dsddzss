let db;

// Initialize IndexedDB
const initDB = () => {
  const request = indexedDB.open('StegoXDB', 1);

  request.onerror = (event) => {
    console.error("Database error:", event.target.error);
  };

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('encodedImages')) {
      const store = db.createObjectStore('encodedImages', { keyPath: 'key' });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
  };

  request.onsuccess = (event) => {
    db = event.target.result;
  };
};

// Call initDB when the page loads
initDB();

// Helper function to save encoded image
function saveEncodedImage(key, imageData, encryptedMessage, passwordHash) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['encodedImages'], 'readwrite');
    const store = transaction.objectStore('encodedImages');
    
    const item = {
      key: key,
      image: imageData,
      encryptedMessage: encryptedMessage,
      passwordHash: passwordHash,
      timestamp: new Date().toISOString()
    };

    const request = store.put(item);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper function to retrieve encoded image
function getEncodedImage(key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['encodedImages'], 'readonly');
    const store = transaction.objectStore('encodedImages');
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
  
$('button.encode, button.decode').click(function(event) {
    event.preventDefault();
  });
  
  function previewDecodeImage() {
    var file = document.querySelector('input[name=decodeFile]').files[0];
  
    previewImage(file, ".decode canvas", function() {
      $(".decode").fadeIn(300);
    });
  }
  
  function previewEncodeImage() {
    var file = document.querySelector("input[name=baseFile]").files[0];
  
    $(".images .nulled").hide();
    $(".images .message").hide();
  
    previewImage(file, ".original canvas", function() {
      $(".images .original").fadeIn(300);
      $(".images").fadeIn(300);
    });
  }
  
  function previewImage(file, canvasSelector, callback) {
    var reader = new FileReader();
    var image = new Image;
    var $canvas = $(canvasSelector);
    var context = $canvas[0].getContext('2d');
  
    if (file) {
      reader.readAsDataURL(file);
    }
  
    reader.onloadend = function () {
      image.src = URL.createObjectURL(file);
  
      image.onload = function() {
        $canvas.prop({
          'width': image.width,
          'height': image.height
        });
  
        context.drawImage(image, 0, 0);
  
        callback();
      }
    }
  }
  
  function generateKey() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  function encryptMessage(message, password) {
    let encrypted = '';
    for(let i = 0; i < message.length; i++) {
      encrypted += String.fromCharCode(
        message.charCodeAt(i) ^ password.charCodeAt(i % password.length)
      );
    }
    return encrypted;
  }
  
  function decryptMessage(encrypted, password) {
    return encryptMessage(encrypted, password);
  }
  
  function checkDBStatus() {
    if (!db) {
      $(".error")
        .text("Database not initialized. Please refresh the page.")
        .fadeIn();
      return false;
    }
    return true;
  }
  
  function encodeMessage() {
    if (!checkDBStatus()) return;
    $(".error").hide();
    $(".binary").hide();
    $(".key-info").hide();
  
    var text = $("textarea.message").val();
    var password = $(".encode-password").val();
  
    if (!password) {
      $(".error").text("Please enter a password").fadeIn();
      return;
    }
  
    const key = generateKey();
    const passwordHash = hashPassword(password);
    const encryptedText = encryptMessage(text, password);
  
    var $originalCanvas = $('.original canvas');
    var $nulledCanvas = $('.nulled canvas');
    var $messageCanvas = $('.message canvas');
  
    var originalContext = $originalCanvas[0].getContext("2d");
    var nulledContext = $nulledCanvas[0].getContext("2d");
    var messageContext = $messageCanvas[0].getContext("2d");
  
    var width = $originalCanvas[0].width;
    var height = $originalCanvas[0].height;
  
    if ((encryptedText.length * 8) > (width * height * 3)) {
      $(".error")
        .text("Text too long for chosen image....")
        .fadeIn();
  
      return;
    }
  
    $nulledCanvas.prop({
      'width': width,
      'height': height
    });
  
    $messageCanvas.prop({
      'width': width,
      'height': height
    });
  
    var original = originalContext.getImageData(0, 0, width, height);
    var pixel = original.data;
    for (var i = 0, n = pixel.length; i < n; i += 4) {
      for (var offset = 0; offset < 3; offset++) {
        if (pixel[i + offset] % 2 != 0) {
          pixel[i + offset]--;
        }
      }
    }
    nulledContext.putImageData(original, 0, 0);
  
    var binaryMessage = "";
    for (i = 0; i < encryptedText.length; i++) {
      var binaryChar = encryptedText[i].charCodeAt(0).toString(2);
  
      while (binaryChar.length < 8) {
        binaryChar = "0" + binaryChar;
      }
  
      binaryMessage += binaryChar;
    }
    $('.binary textarea').text(binaryMessage);
  
    var message = nulledContext.getImageData(0, 0, width, height);
    pixel = message.data;
    counter = 0;
    for (var i = 0, n = pixel.length; i < n; i += 4) {
      for (var offset = 0; offset < 3; offset++) {
        if (counter < binaryMessage.length) {
          pixel[i + offset] += parseInt(binaryMessage[counter]);
          counter++;
        } else {
          break;
        }
      }
    }
    messageContext.putImageData(message, 0, 0);
  
    $(".binary").fadeIn(300);
    $(".images .nulled").fadeIn(300);
    $(".images .message").fadeIn(300);
  
    const imageData = $('.message canvas')[0].toDataURL('image/png');
    const storageItem = {
      image: imageData,
      timestamp: new Date().toISOString(),
      encryptedMessage: encryptedText,
      passwordHash: passwordHash
    };
  
    localStorage.setItem(`stegox_${key}`, JSON.stringify(storageItem));
  
    saveEncodedImage(key, imageData, encryptedText, passwordHash)
      .then(() => {
        $(".generated-key").text(key);
        $(".key-info").fadeIn();
      })
      .catch(error => {
        $(".error")
          .text("Failed to save encoded image: " + error.message)
          .fadeIn();
      });
  }
  
  function downloadEncodedImage() {
    var $messageCanvas = $('.message canvas');
    var image = $messageCanvas[0].toDataURL("image/png");
  
    var a = document.createElement('a');
    a.href = image;
    a.download = 'encoded_image.png';
    a.click();
  }
  
  function downloadDecodedImage() {
    var $originalCanvas = $('.decode canvas');
    var image = $originalCanvas[0].toDataURL("image/png");
  
    var a = document.createElement('a');
    a.href = image;
    a.download = 'decoded_image.png';
    a.click();
  }
  
  $('button.download-encoded').click(function(event) {
    event.preventDefault();
    downloadEncodedImage();
  });
  
  $('button.download-decoded').click(function(event) {
    event.preventDefault();
    downloadDecodedImage();
  });
  
  function decodeMessage() {
    $(".decode-error").hide();
    $(".binary-decode").hide();
  
    var password = $(".decode-password").val();
    if (!password) {
      $(".decode-error")
        .text("Please enter the password used for encoding")
        .fadeIn();
      return;
    }
  
    var $originalCanvas = $('.decode canvas');
    var originalContext = $originalCanvas[0].getContext("2d");
  
    var original = originalContext.getImageData(0, 0, $originalCanvas.width(), $originalCanvas.height());
    var binaryMessage = "";
    var pixel = original.data;
    
    // Extract binary message from image
    for (var i = 0, n = pixel.length; i < n; i += 4) {
      for (var offset = 0; offset < 3; offset++) {
        var value = 0;
        if (pixel[i + offset] % 2 != 0) {
          value = 1;
        }
        binaryMessage += value;
      }
    }
  
    // Convert binary to encrypted text
    var encryptedOutput = "";
    for (var i = 0; i < binaryMessage.length; i += 8) {
      var c = 0;
      for (var j = 0; j < 8; j++) {
        c <<= 1;
        c |= parseInt(binaryMessage[i + j]);
      }
      encryptedOutput += String.fromCharCode(c);
    }
  
    try {
      // Attempt to decrypt the message using the provided password
      const decryptedMessage = decryptMessage(encryptedOutput, password);
      
      // Check if the decrypted message contains valid text
      if (decryptedMessage.length > 0 && /^[\x20-\x7E]*$/.test(decryptedMessage)) {
        $('.binary-decode textarea').text(decryptedMessage);
        $('.binary-decode').fadeIn();
      } else {
        throw new Error("Invalid decryption");
      }
    } catch (e) {
      $(".decode-error")
        .text("Invalid password or corrupted message")
        .fadeIn();
    }
  }
  
  function previewSearchImage() {
    var file = document.querySelector('input[name=searchFile]').files[0];
  
    previewImage(file, ".search-preview canvas", function() {
      $(".search-preview").fadeIn();
    });
  }
  
  function searchMessage() {
    if (!checkDBStatus()) return;
    const key = $(".search-key").val().trim();
    const password = $(".search-password").val();
  
    if (!key || !password) {
      $(".search-message")
        .removeClass("alert-success alert-danger")
        .addClass("alert-warning")
        .text("Please enter both key and password")
        .parent().fadeIn();
      return;
    }
  
    // Search in IndexedDB
    getEncodedImage(key)
      .then(data => {
        if (!data) {
          throw new Error("No image found with this key");
        }
  
        // Verify password hash matches
        const inputPasswordHash = hashPassword(password);
        if (inputPasswordHash !== data.passwordHash) {
          throw new Error("Invalid password");
        }
  
        try {
          const decryptedMessage = decryptMessage(data.encryptedMessage, password);
          
          $(".decoded-message textarea").val(decryptedMessage);
          $(".decoded-message").fadeIn();
          
          $(".search-message")
            .removeClass("alert-danger alert-warning")
            .addClass("alert-success")
            .text("Message successfully decoded!")
            .parent().fadeIn();
        } catch (e) {
          $(".search-message")
            .removeClass("alert-success alert-warning")
            .addClass("alert-danger")
            .text("Failed to decrypt message")
            .parent().fadeIn();
        }
      })
      .catch(error => {
        $(".search-message")
          .removeClass("alert-success alert-warning")
          .addClass("alert-danger")
          .text(error.message)
          .parent().fadeIn();
      });
  }
  
  $('button.search').click(function(event) {
    event.preventDefault();
    searchMessage();
  });
  
  function hashPassword(password) {
    // Simple hash function - in production, use a proper crypto library
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
  
  // Add smooth transitions for UI elements
  function showElement(selector) {
    $(selector)
      .addClass('fade-in')
      .show();
  }
  
  // Update existing show/hide calls
  $(".images .original").hide().addClass('fade-in').fadeIn(300);
  $(".binary").hide().addClass('fade-in').fadeIn(300);
  // ... etc ...
  
  function handleFileSelect(input, type) {
    const fileName = input.files[0]?.name;
    const container = input.closest('.file-input-container');
    const fileNameElement = container.querySelector('.file-name');
    
    if (fileName) {
      fileNameElement.textContent = fileName;
      container.querySelector('.file-input-trigger').style.borderStyle = 'solid';
    } else {
      fileNameElement.textContent = '';
      container.querySelector('.file-input-trigger').style.borderStyle = 'dashed';
    }

    // Call the appropriate preview function
    if (type === 'encode') {
      previewEncodeImage();
    } else if (type === 'decode') {
      previewDecodeImage();
    }
  }
  
