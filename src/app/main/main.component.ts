import { Component, OnInit, HostListener } from '@angular/core';
import { Ros, Topic, Message } from 'roslib';
import * as Leap  from 'leapjs';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  public rad: number = 0;
  ip: string;
  connected:boolean = false;
  ros: Ros;
  topic: Topic;
  cmd_topic: Topic;
  pos: number = 0;

  COMMAND_ALLOWED = ['a', 'd', 'w', 's', 'q', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  constructor() { }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) { 
    console.log('pressed', event.key);
    console.log(this.cmd_topic);
    if (this.cmd_topic !== undefined) {
      console.log('here');
      if (this.COMMAND_ALLOWED.indexOf(event.key) != -1) {
        this.cmd_topic.publish(new Message({
          data: event.key
        }))
      }
    }
  }

  connect() {
    this.ros = new Ros({
      url: 'ws://' + this.ip + ':9090'
    });

    this.ros.on('connection', () => {
      this.connected = true;


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
