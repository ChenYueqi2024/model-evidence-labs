import {train} from './model.js';
self.onmessage = ({data}) => {
  try {
    const weights = train(data, step => self.postMessage({step}));
    self.postMessage({weights}, [weights.buffer]);
  } catch {
    self.postMessage({failed:true});
  }
};
