// This file contains the JavaScript code for the website. 
// It includes functionality to enhance user interaction and manipulate the DOM.

document.addEventListener('DOMContentLoaded', () => {
    const greetingElement = document.getElementById('greeting');
    if (greetingElement) {
        greetingElement.textContent = 'Welcome to My Website!';
    }

    const button = document.getElementById('myButton');
    if (button) {
        button.addEventListener('click', () => {
            alert('Button clicked!');
        });
    }
});