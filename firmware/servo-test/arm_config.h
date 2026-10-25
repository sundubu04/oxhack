// Generated from app/arm.config.json by app/tools/arduino-export.mjs (2026-10-25 02:25).
// Change the config (or the app's Arm setup page) and run "./firmware/arm config", not this file.
// Angles are centi-degrees of servo travel (0 to 18000) unless they say deg.
#pragma once
#define ARM_NAME "Clockedin arm"
const uint8_t PIN[3] = {9, 10, 11};              // base, elbow, tilt signal pins
const int US_MIN[3] = {544, 544, 544};         // pulse at 0 deg of servo travel
const int US_MAX[3] = {2400, 2400, 2400};      // pulse at 180 deg
const int16_t LIMIT_MIN[3] = {0, 0, 0};
const int16_t LIMIT_MAX[3] = {18000, 18000, 18000};
const int16_t PARK[3] = {15000, 2000, 6000};       // beside the drawing, pen lifted
const int16_t TILT_DRAW = 3000, TILT_LIFT = 6000, TILT_ERASE = 17000;
// geometry for moving the pen to a board point: servo deg = OFFSET + DIR * RATIO * joint deg
const float OFFSET[3] = {-60, 175, 90}, DIR[3] = {1, 1, 1}, RATIO[3] = {1, 1, 1};
const float L1 = 157, L2 = 190, NIB_ALONG = 0.00, NIB_SIDE = 3.00;   // mm; the nib sits NIB_ALONG past the forearm's tip and NIB_SIDE across it
// a servo told to stop dead overshoots: moves the board makes itself (park, jog, the motor test) speed up and slow
// down at SERVO_ACCEL (deg/s²), the motor test's pen at PEN_ACCEL (mm/s²), and a stop eases out over STOP_MS
const float SERVO_ACCEL = 1500, PEN_ACCEL = 1000;
const uint16_t STOP_MS = 120;
const bool ELBOW_UP = false;
const float BOARD_CX = 36.0, BOARD_CY = 194.5;   // mm from the base: the middle of the drawing area
