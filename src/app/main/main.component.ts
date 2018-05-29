import { Component, OnInit, HostListener } from '@angular/core';
import { Ros, Topic, Message } from 'roslib';
import * as Leap  from 'leapjs';

function createAudioMeter(audioContext) {
	var processor = audioContext.createScriptProcessor(512);
	processor.onaudioprocess = volumeAudioProcess;
	processor.clipping = false;
	processor.lastClip = 0;
	processor.volume = 0;
	processor.clipLevel = 0.98;
	processor.averaging = 0.95;
	processor.clipLag = 750;

	// this will have no effect, since we don't copy the input to the output,
	// but works around a current Chrome bug.
	processor.connect(audioContext.destination);

	processor.checkClipping =
		function(){
			if (!this.clipping)
				return false;
			if ((this.lastClip + this.clipLag) < window.performance.now())
				this.clipping = false;
			return this.clipping;
		};

	processor.shutdown =
		function(){
			this.disconnect();
			this.onaudioprocess = null;
		};

	return processor;
}

function volumeAudioProcess( event ) {
	var buf = event.inputBuffer.getChannelData(0);
    var bufLength = buf.length;
	var sum = 0;
    var x;

	// Do a root-mean-square on the samples: sum up the squares...
    for (var i=0; i<bufLength; i++) {
    	x = buf[i];
    	if (Math.abs(x)>=this.clipLevel) {
    		this.clipping = true;
    		this.lastClip = window.performance.now();
    	}
    	sum += x * x;
    }

    // ... then take the square root of the sum.
    var rms =  Math.sqrt(sum / bufLength);

    // Now smooth this out with the averaging factor applied
    // to the previous sample - take the max here because we
    // want "fast attack, slow release."
    this.volume = Math.max(rms, this.volume*this.averaging);
}




@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  public rad: number = 0;
  ip: string = "virgil01.local";
  connected:boolean = true;
  ros: Ros;
  topic: Topic;
  cmd_topic: Topic;
  pos: number = 0;
  audioContext: any;
  volume: number = 0;
  led_topic: Topic;
  volume_meter = 0;
  volumeOn: boolean = false;

  COMMAND_ALLOWED = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  constructor() { 
    this.runAudio();
  }


  runAudio() {    
      // grab an audio context
      this.audioContext = new AudioContext();
  
      // Attempt to get audio input
      try {  
          // ask for an audio input
          navigator.getUserMedia(
          {
              "audio": {
              },
          }, (stream) => this.gotStream(stream), () => this.didntGetStream() );
      } catch (e) {
          alert('getUserMedia threw exception :' + e);
      }
  }

  gotStream(stream) {
    let mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    let meter = createAudioMeter(this.audioContext);
    mediaStreamSource.connect(meter);
    setInterval( () => this.getVolume(meter), 50);
  }

  getVolume(meter) {
    if (this.volumeOn) {
      this.volume = meter.volume;
      let cmd = Math.ceil(this.volume*2*this.volume_meter);
      if (cmd > 180) cmd = 180;
      if (cmd < 0) cmd = 0;
      if (this.topic !== undefined) {
        this.topic.publish(new Message( {
          data: cmd
          }));
      }
      if (this.led_topic !== undefined) {
        this.led_topic.publish( new Message ({
            data: Math.ceil(meter.volume*500)
          })
        )
      }
    }
  }

  toggleVolume() {
    this.volumeOn = !this.volumeOn;
    this.volume = 0;
    if (this.topic !== undefined) {
      this.topic.publish(new Message( {
        data: 1
        }));
    }
  }

  didntGetStream() {
    console.log('error');
  }

  setLed(e) {
    this.volume_meter = e.target.value;
    this.setLedValue(+e.target.value)
  }

  setLedValue(value) {

    if (this.led_topic != undefined ){
      this.led_topic.publish( new Message({
        data: value
      }));
    }
  }

  

  @HostListener('document:keydown', ['$event'])
  @HostListener('document:keyup', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) { 
    console.log(event.type);
    if (this.cmd_topic !== undefined) {
      if (this.COMMAND_ALLOWED.indexOf(event.key) != -1) {
        let data;
        if (event.type == 'keydown') {
          data = event.key;
        } else {
          data = 'stop';
        }
        this.cmd_topic.publish(new Message({
          data: data
        }));
      }
    }
  }


  connect() {
    this.ros = new Ros({
      url: 'ws://' + this.ip + ':9090'
    });

    this.ros.on('connection', () => {
      this.connected = true;
      
      this.topic = new Topic({
        ros: this.ros,
        name: '/servo',
        messageType: 'std_msgs/UInt8'
      });

      this.led_topic = new Topic({
        ros: this.ros,
        name: '/led',
        messageType: 'std_msgs/UInt16'
      });


      this.cmd_topic = new Topic({
        ros: this.ros,
        name: '/web_cmd',
        messageType: 'std_msgs/String'
      });
    });


    this.ros.on('error', () => {
      this.connected = false;
      console.log('error');
    });

    this.ros.on('close', () => {
      this.connected = false;
    })
  }

  ngOnInit() {



    Leap.loop((frame) => {
      if (frame.hands.length > 0) {
        let hand = frame.hands[0];
        this.rad = Math.round(hand.sphereRadius);
      }
    });


    console.log(Leap);
  
  }

}
