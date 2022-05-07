import React from "react";
import "./style.css";

export default function App() {
  const names = ["Alice", "Bob", "Charlie"];
  return (
    <Network names={names} />
  );
}

class Network extends React.Component {
  constructor(props) {
    super(props);

    this.names = props.names;
    this.nodes = {};
    for (const name of props.names) {
      this.nodes[name] = <Node self={name} net={this} />;
    }
  }

  // Broadcast a message to all nodes.
  broadcast(from, message) {
    for (const node of this.nodes) {
      setTimeout(() => node.receive(from, message));
    }
  }

  // Unicast a message to a particular node.
  unicast(to, from, message) {
    setTimeout(() => nodes[to].receive(from, message));
  }

  render() {
    return (
      <div>
        {this.names.map((name) => this.nodes[name])}
      </div>
    )
  }
}

// NodeView is a component implementing the UI view of a node in a simulated network for testing purposes.
class Node extends React.Component {
  constructor(props) {
    super(props);
    this.names = props.net.names;
    this.pax = new paxPushNode(this);
  }

  // Send a virtual network broadcast from this node to all
  broadcast(message) {
    this.props.net.broadcast(this.props.self, message);
  }

  unicast(to, message) {
    this.props.net.unicast(to, this.props.self, message);
  }

  // Receive a virtual broadcast from any node (this or other)
  receive(from, message) {
    this.pax.receive(from, message);
  }

  render() {
    return (
      <div>
        <h1> Node {this.props.self} </h1>
        <NumberConsenser node={this} />
      </div>
    );  
  }
}

class NumberConsenser extends React.Component {
  constructor(props) {
    super(props);
    this.handleValueChange = this.handleValueChange.bind(this);
    this.state = { "value": null };
    this.cons = (
      <Consenser node={props.node} proposal={this.state.value}>
        <div>
          {this.props.children}
          Value to propose: 
          <input type="number" value={this.state.value} onChange={this.handleValueChange} /> 
        </div>
      </Consenser>
    );
  }

  handleValueChange(e) {
    this.setState({ "value": e.target.value });
  }

  render() {
    return this.cons;
  }
}

class Consenser extends React.Component {
  constructor(props) {
    super(props);
    this.node = props.node;
    this.handlePropose = this.handlePropose.bind(this);
    this.valueString = props.valueString ?? ((v) => v != null ? v.toString() : "");
  }

  handlePropose(e) {
    this.node.pax.propose(this.props.proposal);
  }

  render() {
    const proposeButton = <button type="button" class="consenserButton" onClick={this.handlePropose}>Propose {this.valueString(this.props.proposal)}</button>
    const approveButtons = this.node.names.map((nodeName) => (
      <button type="button" class="consenserButton">Approve <br/> <br/> from {nodeName} </button>
      )
    );
    return (
      <div class="consenserBox">
        {this.props.children}
        {proposeButton}
        <div class="consenserApproveBox">
          {approveButtons}
        </div>
      </div>
    );
  }
}

class paxStep {
  constructor(choice, retry) {
    this.choice = choice;
    this.retry = retry;
  }

  eq(other) {
    return this.choice == other.choice && this.retry == other.retry;
  }

  lt(other) {
    return this.choice < other.choice || 
      (this.choice == other.choice && this.retry < other.retry);
  }

  le(other) {
    return this.choice < other.choice ||
      (this.choice == other.choice && this.retry <= other.retry);
  }
}

class paxPushNode {
  constructor(node, threshold) {

    console.assert(threshold*2 > node.names.length,
      'threshold ' + threshold + ' too small for ' + node.names.length + ' nodes');
    console.assert(threshold <= node.names.length,
      'threshold ' + threshold + ' too large for ' + node.names.length + ' nodes');

    this.node = node;
    this.threshold = threshold;
    this.choice = 0;
    this.retry = 0;
    this.waits = {}; // labels we're awaiting responses for
    this.lasts = {}; // last valid certificate we've seen from each node
  }

  propose(value) {
    console.log("propose " + value);

    this.ask({'type': 'follow'}) // ask permission to lead a consensus attempt
    .then((replies) => {
      return this.ask({'type': 'reserve'})
    })
    .then((replies) => {
      return this.ask({'type': 'accept'})
    })
    .then((replies) => {
      return this.ask({'type': 'commit'})
    })
    .then((replies) => {
      // Technically we don't have to wait for commit responses,
      // but it doesn't hurt and tells us when commitment is "well-known".
      console.log("committed " + value);
    })
    .catch((msg) => {
      // This proposal attempt was aborted by message msg from a future logical time
      console.log("proposal of " + value + " failed")
    })
  }

  ask(msg) {
    msg.choice = this.choice;
    msg.retry = this.retry;
    msg.label = label(this.choice, this.retry, msg.type);
    console.assert(this.waits[msg.label] == null, "duplicate broadcast of " + msg.label);
    return new Promise(
      (resolve, reject) => {
        this.waits[msg.label] = {
          'resolve': resolve,
          'reject': reject,
          'request': msg,
          'replies': {},
          'count': 0,
        };
        this.node.broadcast(msg);
      }
    )
  }
  
  // Receive a message that needs to be validated first, then handled.
  receive(from, msg) {
    this.validate(from, msg)
    .then(() => this.handle(from, msg))
    .catch(err) {
      console.log("dropping invalid message");
    }
  }

  // Handle a received message that has already been fully validated.
  handle(from, msg) {

    // Handle incoming broadcasts
    switch (msg.type) {
    case 'follow': // a node requesting permission to lead a try number
      break;
    case 'reserve': // a node asking to reserve a try number
      break;
    case 'accept': // a node asking to accept a threshold-reserved result
      break;
    case 'commit': // a node informing us that a try number has been committed
      break;
    }

    // See if this is a unicast response we're waiting for.
    const wait = this.waits[msg.label];
    if (wait != null) {
      console.assert(wait.replies[from] == null, "duplicate reply from " + from);

      // This is a response - but is the responder ahead of us in logical time?
      if (msg.choice > wait.request.choice || msg.retry > wait.request.retry) {
        delete this.waits[msg.label]; // cancel our wait since we're moving on
        wait.reject(msg); // reject using the message we'll need to catch up from
        return
      }
      console.assert(msg.choice == wait.request.choice && msg.retry == wait.request.retry, "reply apparently from the logical past!?");

      // Collect a threshold of replies from this time-step.
      wait.replies[from] = message;
      wait.count++;
      if (wait.count >= this.threshold) {
        delete this.waits[msg.label]; // we're no longer waiting for replies
        wait.resolve(wait.replies); // resolve with the set of replies received
      }
    }
  }

  // Combine a choice number, try number, and message type
  // into a single string to serve as a unique message label.
  label(ch, re, ty) {
    return ch.toString() + "-" + re.toString() + "-" + ty;
  }

  // Validate a message received from a particular node.
  // Asynchronous: returns a Promise.
  validate(from, msg) {
    return new Promise(
      (resolve, reject) => {
        switch (msg.type) {
          case 'follow':
            const last = this.lasts[from];
            if ((last != null) &&  {
      
            }
            this.lasts[from = msg];
            break;
          }      
      }
    )
  }
}

// paxSigCert implements simple signature-based certificates,
// where a certificate is simply a threshold number of
// individual digital signatures on the same state encoding.
class paxSigCert {
  constructor() {
    this.complete = false;
  }

  // Validate a received certificate share, i.e., signature.
  // Asynchronous: returns a Promise.
  async validate(from, sig) {

  }

  // Incorporate a received signature into the certificate.
  // Completes the certificate if/when the threshold is reached.
  add(sig) {

    return this.complete;
  }
}
