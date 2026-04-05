# media-room

<img src="web/app/images/mascot.svg" alt="popcorn mascot" height="200">

[![python](https://img.shields.io/badge/python-f7dc65?logo=python)](https://www.python.org/)
![javascript vanilla](https://img.shields.io/badge/javascript-grey?logo=javascript)
[![jquery](https://img.shields.io/badge/jquery-0865a7?logo=jquery)](https://jquery.com/)
[![mini.css](https://img.shields.io/badge/mini.css-f22f21)](https://minicss.us/)

A minimal and responsive media chat room

## About

This application is composed of two parts, server and web, intended to be used via Docker container on any Linux server supporting SSL.

It uses a secure websockets for the connection (`wss://`). The server part allows users to log into the desired room and join other people for real-time communication and watching video together in sync.

### [Demo at mediaroom.pxly.fr](https://mediaroom.pxly.fr)

## Usage

Please refer to the README of the corresponding `web` and `server` folders.
