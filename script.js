(() => {
      // South African local time (UTC+2). Countdown targets 16 December 2026, 00:00.
      const target = new Date('2026-12-16T00:00:00+02:00').getTime();
      const fields = {
        days: document.getElementById('cd-days'),
        hours: document.getElementById('cd-hours'),
        mins: document.getElementById('cd-mins'),
        secs: document.getElementById('cd-secs')
      };

      function updateCountdown() {
        const remaining = target - Date.now();

        if (remaining <= 0) {
          Object.values(fields).forEach(field => field.textContent = '00');
          document.querySelector('.launch-date').textContent = 'Our expected launch date has arrived';
          return;
        }

        const days = Math.floor(remaining / 86400000);
        const hours = Math.floor((remaining % 86400000) / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);

        fields.days.textContent = String(days).padStart(2, '0');
        fields.hours.textContent = String(hours).padStart(2, '0');
        fields.mins.textContent = String(mins).padStart(2, '0');
        fields.secs.textContent = String(secs).padStart(2, '0');
      }

      updateCountdown();
      setInterval(updateCountdown, 1000);
    })();

    (() => {
      const form = document.getElementById('waitlist-form');
      const status = document.getElementById('form-status');
      const webhookUrl = 'https://n8n.zyma.co.za/webhook/tholulwazi-enquiry';
      const steps = Array.from(form.querySelectorAll('[data-step]'));
      const indicators = Array.from(form.querySelectorAll('[data-step-indicator]'));
      const progressFill = document.getElementById('progress-fill');
      const backButton = document.getElementById('step-back');
      const nextButton = document.getElementById('step-next');
      const submitButton = document.getElementById('submit-request');
      const review = document.getElementById('request-review');
      const progress = form.querySelector('.step-progress');
      const mobileLayout = window.matchMedia('(max-width: 760px)');
      let currentStep = 0;

      function updateReview() {
        const data = new FormData(form);
        const subjects = data.getAll('subjects');
        const details = [
          ['Parent / Guardian', data.get('parentName')],
          ['Learner', data.get('learnerName')],
          ['Email', data.get('email')],
          ['Phone', data.get('phone')],
          ['Grade', data.get('grade')],
          ['Subjects', subjects.length ? subjects.join(', ') : 'Not specified'],
          ['Preferred delivery', data.get('delivery')]
        ];

        review.replaceChildren();
        details.forEach(([label, value]) => {
          const item = document.createElement('div');
          const title = document.createElement('span');
          const detail = document.createElement('strong');
          item.className = 'review-item';
          title.textContent = label;
          detail.textContent = value;
          item.append(title, detail);
          review.append(item);
        });
      }

      function showStep(index, moveFocus = true) {
        currentStep = index;
        steps.forEach((step, stepIndex) => {
          step.hidden = stepIndex !== currentStep;
        });
        indicators.forEach((indicator, stepIndex) => {
          indicator.classList.toggle('is-current', stepIndex === currentStep);
          indicator.classList.toggle('is-complete', stepIndex < currentStep);
          if (stepIndex === currentStep) {
            indicator.setAttribute('aria-current', 'step');
          } else {
            indicator.removeAttribute('aria-current');
          }
        });
        progressFill.style.width = `${(currentStep / (steps.length - 1)) * 100}%`;
        backButton.hidden = !mobileLayout.matches || currentStep === 0;
        nextButton.hidden = !mobileLayout.matches || currentStep === steps.length - 1;
        submitButton.hidden = mobileLayout.matches && currentStep !== steps.length - 1;
        status.textContent = '';
        status.classList.remove('is-error', 'is-success');
        if (moveFocus && mobileLayout.matches) {
          steps[currentStep].querySelector('h3').focus({ preventScroll: true });
        }

        if (mobileLayout.matches && currentStep === steps.length - 1) {
          updateReview();
        }
      }

      function validateFields(container) {
        const fields = container.querySelectorAll('input, select, textarea');
        for (const field of fields) {
          if (field.required && !field.checkValidity()) {
            field.reportValidity();
            return false;
          }
        }
        return true;
      }

      function updateLayout() {
        progress.hidden = !mobileLayout.matches;
        if (mobileLayout.matches) {
          currentStep = 0;
          showStep(currentStep, false);
          return;
        }

        steps.forEach(step => {
          step.hidden = false;
        });
        backButton.hidden = true;
        nextButton.hidden = true;
        submitButton.hidden = false;
        review.replaceChildren();
        status.textContent = '';
        status.classList.remove('is-error', 'is-success');
      }

      nextButton.addEventListener('click', () => {
        if (validateFields(steps[currentStep])) {
          showStep(currentStep + 1);
        }
      });

      backButton.addEventListener('click', () => {
        showStep(currentStep - 1);
      });

      updateLayout();
      mobileLayout.addEventListener('change', updateLayout);

      form.addEventListener('submit', event => {
        event.preventDefault();

        if (!validateFields(mobileLayout.matches ? steps[currentStep] : form)) {
          return;
        }
        if (mobileLayout.matches && currentStep < steps.length - 1) {
          showStep(currentStep + 1);
          return;
        }

        const data = new FormData(form);
        const subjects = data.getAll('subjects');

        const payload = {
          parentName: String(data.get('parentName') || '').trim(),
          learnerName: String(data.get('learnerName') || '').trim(),
          email: String(data.get('email') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          grade: String(data.get('grade') || '').trim(),
          subjects,
          delivery: String(data.get('delivery') || '').trim(),
          message: ''
        };

        const originalButtonText = submitButton.textContent.trim();
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true');
        status.textContent = 'Submitting your enquiry…';

        fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        })
          .then(async response => {
            const responseText = await response.text();
            let result = {};

            if (responseText) {
              try {
                result = JSON.parse(responseText);
              } catch {
                result = { message: responseText };
              }
            }

            if (!response.ok) {
              throw new Error(
                result.message || result.error || 'We could not submit your enquiry. Please try again.'
              );
            }

            return result;
          })
          .then(result => {
            status.textContent =
              result.message ||
              'Thank you! Your enquiry has been submitted successfully. The Tholulwazi admissions team will be in touch.';
            status.classList.remove('is-error');
            status.classList.add('is-success');
            form.reset();
            updateReview();
          })
          .catch(error => {
            console.error('Tholulwazi enquiry submission failed:', error);
            status.textContent =
              error.message ||
              'Something went wrong while submitting your enquiry. Please check your connection and try again.';
            status.classList.remove('is-success');
            status.classList.add('is-error');
          })
          .finally(() => {
            submitButton.disabled = false;
            submitButton.removeAttribute('aria-busy');
            submitButton.innerHTML = `${originalButtonText.replace(/\s*→\s*$/, '')} <span aria-hidden="true">→</span>`;
          });
      });
    })();
