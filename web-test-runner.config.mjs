/* eslint-disable import/no-extraneous-dependencies */

import { importMapsPlugin } from '@web/dev-server-import-maps';
import { defaultReporter, summaryReporter } from '@web/test-runner';
// eslint-disable-next-line import/extensions
import diffReporter from './tools/wtr/diffReporter.mjs';

const GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';

function customReporter() {
  return {
    async reportTestFileResults({ logger, sessionsForTestFile }) {
      sessionsForTestFile.forEach((session) => {
        session.testResults.tests.forEach((test) => {
          if (!test.passed && !test.skipped) {
            logger.log(test);
          }
        });
      });
    },
  };
}

export default {
  coverageConfig: {
    include: [
      '**/nx/**',
      '**/scripts/**',
    ],
    exclude: [
      '**/mocks/**',
      '**/node_modules/**',
      '**/test/**',
      '**/deps/**',
    ],
  },
  testFramework: { config: { retries: GITHUB_ACTIONS ? 1 : 0 } },
  plugins: [importMapsPlugin({})],
  reporters: [
    defaultReporter({ reportTestResults: false, reportTestProgress: true }),
    customReporter(),
    summaryReporter(),
    diffReporter(),
  ],
  testRunnerHtml: (testFramework) => `
    <html>
      <head>
        <link rel="icon" href="/libs/img/favicons/favicon.ico" size="any">
        <script type='module'>
          const oldFetch = window.fetch;
          window.fetch = async (resource, options) => {
            if (!resource.startsWith('/') && !resource.startsWith('http://localhost')) {
              console.error(
                '** fetch request for an external resource is disallowed in unit tests, please find a way to mock! https://github.com/orgs/adobecom/discussions/814#discussioncomment-6060759 provides guidance on how to fix the issue.',
                resource
              );
            }
            return oldFetch.call(window, resource, options);
          };

          const oldXHROpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = async function (...args) {
            let [method, url, asyn] = args;
            if (!resource.startsWith('/') && url.startsWith('http://localhost')) {
              console.error(
                '** XMLHttpRequest request for an external resource is disallowed in unit tests, please find a way to mock! https://github.com/orgs/adobecom/discussions/814#discussioncomment-6060759 provides guidance on how to fix the issue.',
                url
              );
            }
            return oldXHROpen.apply(this, args);
          };

          const observer = new MutationObserver((mutationsList, observer) => {
            for(let mutation of mutationsList) {
              if (mutation.type === 'childList') {
                for(let node of mutation.addedNodes) {
                  if(node.nodeName === 'SCRIPT' && node.src && !node.src.startsWith('http://localhost')) {
                    console.error(
                      '** An external 3rd script has been added. This is disallowed in unit tests, please find a way to mock! https://github.com/orgs/adobecom/discussions/814#discussioncomment-6060891 provides guidance on how to fix the issue.',
                      node.src
                    );
                  }
                }
              }
            }
          });
          observer.observe(document.head, { childList: true });
        </script>
      </head>
      <body>
        <script type='module' src='${testFramework}'></script>
      </body>
    </html>`,
  // Comment in the files for selectively running test suites
  // npm run test:file:watch allows to you to run single test file & view the result in a browser.
  // files: ['**/utils.test.js'],
};
