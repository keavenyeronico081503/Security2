const pupils = document.querySelectorAll('.pupil');
        const eyes = document.querySelectorAll('.eye');

        document.addEventListener('mousemove', (e) => {
            pupils.forEach((pupil, index) => {
                const eye = eyes[index];
                const eyeRect = eye.getBoundingClientRect();
                const eyeCenterX = eyeRect.left + eyeRect.width / 2;
                const eyeCenterY = eyeRect.top + eyeRect.height / 2;

                const angle = Math.atan2(e.clientY - eyeCenterY, e.clientX - eyeCenterX);
                
                const maxDistance = 25;
                const pupilX = Math.cos(angle) * maxDistance;
                const pupilY = Math.sin(angle) * maxDistance;

                pupil.style.transform = `translate(calc(-50% + ${pupilX}px), calc(-50% + ${pupilY}px))`;
            });
        });

        document.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            pupils.forEach((pupil, index) => {
                const eye = eyes[index];
                const eyeRect = eye.getBoundingClientRect();
                const eyeCenterX = eyeRect.left + eyeRect.width / 2;
                const eyeCenterY = eyeRect.top + eyeRect.height / 2;

                const angle = Math.atan2(touch.clientY - eyeCenterY, touch.clientX - eyeCenterX);
                
                const maxDistance = 25;
                const pupilX = Math.cos(angle) * maxDistance;
                const pupilY = Math.sin(angle) * maxDistance;

                pupil.style.transform = `translate(calc(-50% + ${pupilX}px), calc(-50% + ${pupilY}px))`;
            });
        });