// document.addEventListener('DOMContentLoaded', function() {
//     // Get DOM elements
//     const cards = document.querySelectorAll('.position-card');
//     const overlay = document.getElementById('fullscreen-overlay');
//     const closeBtn = document.getElementById('close-fullscreen');
//     const fullscreenMedia = overlay.querySelector('.fullscreen-media');
//     const fullscreenTitle = overlay.querySelector('.fullscreen-body h2');
//     const fullscreenDesc = overlay.querySelector('.fullscreen-description');

//     // Add click event to each card
//     cards.forEach(card => {
//         card.addEventListener('click', () => {
//             const title = card.querySelector('h3').textContent;
//             const description = card.getAttribute('data-description');
//             const bgImage = card.querySelector('.card-media').style.backgroundImage;
            
//             // Update fullscreen content
//             fullscreenTitle.textContent = title;
//             fullscreenDesc.textContent = description;
//             fullscreenMedia.style.backgroundImage = bgImage;
            
//             // Show overlay
//             overlay.classList.add('active');
//             document.body.style.overflow = 'hidden'; // Prevent scrolling when overlay is open
//         });
//     });

//     // Close overlay when clicking the close button
//     closeBtn.addEventListener('click', (e) => {
//         e.stopPropagation();
//         closeOverlay();
//     });

//     // Close overlay when clicking outside the content
//     overlay.addEventListener('click', (e) => {
//         if (e.target === overlay) {
//             closeOverlay();
//         }
//     });

//     // Close overlay with Escape key
//     document.addEventListener('keydown', (e) => {
//         if (e.key === 'Escape' && overlay.classList.contains('active')) {
//             closeOverlay();
//         }
//     });

//     function closeOverlay() {
//         overlay.classList.remove('active');
//         document.body.style.overflow = ''; // Re-enable scrolling
//     }
// });
