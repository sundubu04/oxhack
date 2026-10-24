// Generated from app/arm.config.json by app/tools/arduino-export.mjs (2026-10-24 22:27).
// Change the config (or the app's Arm setup page) and run "./firmware/arm config", not this file.
// Angles are centi-degrees of servo travel (0 to 18000) unless they say deg.
#pragma once
#define ARM_NAME "Clockedin arm"
const uint8_t PIN[3] = {9, 10, 11};              // base, elbow, tilt signal pins
const int US_MIN[3] = {544, 544, 544};         // pulse at 0 deg of servo travel
const int US_MAX[3] = {2400, 2400, 2400};      // pulse at 180 deg
const int16_t LIMIT_MIN[3] = {0, 0, 0};
const int16_t LIMIT_MAX[3] = {18000, 18000, 18000};
const int16_t PARK[3] = {8189, 10151, 3756};       // beside the drawing, pen lifted
const int16_t TILT_DRAW = 3274, TILT_LIFT = 3756, TILT_ERASE = 14726;
// geometry for moving the pen to a board point: servo deg = OFFSET + DIR * RATIO * joint deg
const float OFFSET[3] = {-77, 193, 90}, DIR[3] = {1, 1, 1}, RATIO[3] = {1, 1, 1};
const float L1 = 160, L2 = 200, NIB_SIDE = 46.13;   // mm; the nib sits NIB_SIDE across the forearm's tip
// a servo told to stop dead overshoots: moves the board makes itself (park, jog, the motor test) speed up and slow
// down at SERVO_ACCEL (deg/s²), the motor test's pen at PEN_ACCEL (mm/s²), and a stop eases out over STOP_MS
const float SERVO_ACCEL = 1500, PEN_ACCEL = 1000;
const uint16_t STOP_MS = 300;
const bool ELBOW_UP = false;
const float BOARD_CX = 0, BOARD_CY = 215;   // mm from the base: the middle of the drawing area
