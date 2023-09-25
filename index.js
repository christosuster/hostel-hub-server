const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const nodeCron = require("node-cron");
const SSLCommerzPayment = require("sslcommerz-lts");
const port = process.env.PORT || 5000;

// middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

//uri of database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r55pe8p.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//SSL COMMERZ
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false;

async function run() {
  try {
    await client.connect();
    const database = client.db("hostel-management-system");
    const usersCollection = database.collection("users");
    const roomCollection = database.collection("rooms");
    const mealCollection = database.collection("meals");
    const orderCollection = database.collection("orders");
    const paymentCollection = database.collection("payments");
    const noticeCollection = database.collection("notices");

    // Create user
    app.post("/users-data", async (req, res) => {
      const cursor = await usersCollection.insertOne(req.body);
      res.json(cursor);
    });

    // users when the first time register put api
    app.put("/users-data", async (req, res) => {
      const query = { email: req.body.email };
      const options = { upsert: true };
      const updateDocs = { $set: req.body };

      // getting user info if already have in the db
      const userInfo = await usersCollection.findOne(query);
      if (userInfo) {
        res.send("already in the db ");
      } else {
        const result = await usersCollection.updateOne(
          query,
          updateDocs,
          options
        );
      }
    });

    // put user for google login
    app.put("/users-data", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // user profile update api here
    app.put("/profile-update", async (req, res) => {
      const query = { email: req.body.email };
      const options = { upsert: true };
      const updateDocs = { $set: req.body };
      const result = await usersCollection.updateOne(
        query,
        updateDocs,
        options
      );
      res.json(result);
    });

    // users follow and following api start here
    app.put("/user", async (req, res) => {
      const bloggerId = req.body.bloggerId;
      const userId = req.body.userId;
      const options = { upsert: true };

      // getting blogger info here
      const blogger = await usersCollection.findOne({
        _id: ObjectId(bloggerId),
      });
      const bloggerPayload = {
        id: blogger?._id,
        email: blogger?.email,
        name: blogger?.displayName,
        image: blogger?.image,
      };
      // getting user info here
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });
      const userPayload = {
        id: user?._id,
        email: user?.email,
        name: user?.displayName,
        image: user?.image,
      };

      // update blogger here
      const bloggerDocs = {
        $push: { followers: userPayload },
      };
      // update user here
      const userDocs = {
        $push: { following: bloggerPayload },
      };

      const updateBlogger = await usersCollection.updateOne(
        blogger,
        bloggerDocs,
        options
      );
      const updateUser = await usersCollection.updateOne(
        user,
        userDocs,
        options
      );
      res.send("followers following updated");
    });

    // and user follow and following api end here
    app.get("/users", async (req, res) => {
      const user = usersCollection.find({});
      const result = await user.toArray();
      res.send(result);
    });

    // and user follow and following api end here
    app.get("/users-data", async (req, res) => {
      const user = usersCollection.find({});
      const result = await user.toArray();
      res.send(result);
    });

    // users information by email
    app.get("/users-data/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection?.findOne(query);
      res.json(user);
    });

    //make admin
    app.put("/users/admin", async (req, res) => {
      const user = req.body;

      const currentUser = await usersCollection.findOne({ email: user.email });

      const currentPayment = await usersCollection.findOne({
        email: user.email,
      });

      if (
        currentUser?._id &&
        (currentUser?.room == "" ||
          Object.keys(currentUser?.room).length == 0) &&
        currentPayment?.advance == 0
      ) {
        const filter = { email: user.email };
        const updateDoc = { $set: { role: "admin" } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.json(result);
      } else {
        res.json(-1);
      }
    });

    // user delete api
    //ISSUE
    app.delete("/delete-user/:id", async (req, res) => {
      const query = { _id: ObjectId(req.params.id) };
      const result = await usersCollection.deleteOne(query);
      res.json(result);

      const allBreakfasts = await mealCollection
        .find({ time: "Breakfast" })
        .toArray();

      allBreakfasts.map(async (item) => {
        const newBooking = item.bookedBy.filter(
          (element) => element.uid != req.params.id
        );

        const filter = { _id: item._id };
        const updateDoc = { $set: { bookedBy: newBooking } };
        const result = await mealCollection.updateOne(filter, updateDoc);
      });
    });

    // for getting all room
    app.get("/rooms", async (req, res) => {
      const cursor = roomCollection?.find({});
      const rooms = await cursor?.toArray();
      res.json(rooms);
    });

    // for posting rooms
    app.post("/rooms", async (req, res) => {
      const room = req.body;
      const result = await roomCollection.insertOne(room);
      res.json(result);
    });

    // for single room
    app.get("/rooms/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const cursor = await roomCollection.findOne(query);
      res.json(cursor);
    });

    // room delete api
    app.delete("/delete-room/:id", async (req, res) => {
      const query = { _id: new ObjectId(req?.params?.id) };
      const result = await roomCollection?.deleteOne(query);
      res.json(result);
    });
    // for getting all meal
    app.get("/meals", async (req, res) => {
      const cursor = mealCollection?.find({});
      const meals = await cursor?.toArray();
      res.json(meals);
    });

    // for posting meals
    app.post("/meals", async (req, res) => {
      const meal = req.body;
      const result = await mealCollection.insertOne(meal);
      res.json(result);
    });

    // for single meal
    app.get("/meals/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const cursor = await mealCollection.findOne(query);
      res.json(cursor);
    });

    // meal delete api
    app.delete("/delete-meal/:id", async (req, res) => {
      const query = { _id: new ObjectId(req?.params?.id) };
      const result = await mealCollection?.deleteOne(query);
      res.json(result);
    });

    // payment post api
    app.post("/payment", async (req, res) => {
      const cursor = await paymentCollection.insertOne(req.body);
      res.json(cursor);
    });

    // get payment information by user id
    app.get("/payments/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = { uid: uid };
      const payment = await paymentCollection?.findOne(query);
      res.json(payment);
    });

    // for getting all payments
    app.get("/payments", async (req, res) => {
      const cursor = paymentCollection?.find({});
      const payments = await cursor?.toArray();
      res.json(payments);
    });

    // for getting all orders
    app.get("/orders", async (req, res) => {
      const cursor = orderCollection?.find({});
      const orders = await cursor?.toArray();
      res.json(orders);
    });

    // // for getting all payments
    // //ISSUE: SETS ALL DUE TO 0
    // app.put("/payments", async (req, res) => {
    //   const paymentID = req.body.id;
    //   const amount = req.body.amount;
    //   const paymentType = req.body.amount;
    //   let time = new Date();
    //   const currentTime = time.toLocaleString("en-US", {
    //     hour: "numeric",
    //     minute: "numeric",
    //     hour12: true,
    //   });
    //   const userPaymentRecord = await paymentCollection.findOne({
    //     _id: new ObjectId(paymentID),
    //   });
    //   const paymentQuery = { _id: new ObjectId(paymentID) };
    //   const paymentDoc = {
    //     $push: {
    //       paymentHistory: {
    //         date: time,
    //         time: currentTime,
    //         amount: parseInt(amount),
    //       },
    //     },
    //     $set: {
    //       rent: 0,
    //       due: 0,
    //     },
    //   };
    //   const paymentResult = await paymentCollection.updateOne(
    //     paymentQuery,
    //     paymentDoc
    //   );
    //   res.json(paymentResult);
    //   console.log(paymentResult);
    // });

    // Withdraw money
    app.put("/withdraw/:id", async (req, res) => {
      const withdrawAccount = await paymentCollection.findOne({
        _id: new ObjectId(req?.params?.id),
      });

      let dueAmount =
        parseInt(withdrawAccount?.advance) - parseInt(withdrawAccount?.due);
      if (dueAmount > 0) {
        dueAmount = 0;
      }

      const withdrawMoney = await paymentCollection.updateOne(
        { _id: new ObjectId(req?.params?.id) },
        {
          $set: {
            rent: 0,
            due: dueAmount,
            advance: 0,
          },
        }
      );

      res.json(withdrawMoney);
    });

    // payment post api
    app.post("/notice", async (req, res) => {
      const cursor = await noticeCollection.insertOne(req.body);
      res.json(cursor);
    });

    // for getting all notices
    app.get("/notices", async (req, res) => {
      const cursor = noticeCollection?.find({});
      const notices = await cursor?.toArray();
      res.json(notices);
    });

    // Delete Notice
    app.delete("/delete-notice/:id", async (req, res) => {
      const query = { _id: new ObjectId(req?.params?.id) };
      const result = await noticeCollection?.deleteOne(query);
      res.json(result);
      console.log(result);
    });

    //Cancel room
    app.put("/cancelRoom", async (req, res) => {
      const userId = req.body.currentUser;
      const roomId = req.body.roomId;
      const currentRoom = await roomCollection.findOne({
        _id: new ObjectId(roomId),
      });
      const currentUser = await usersCollection.findOne({
        _id: new ObjectId(userId),
      });

      const allMeals = await mealCollection.find({}).toArray();

      if (currentRoom.category === "Business") {
        const roomFilter = { _id: new ObjectId(roomId) };
        const roomDoc = {
          $set: {
            bookedBy: "",
            bookedOn: "",
            bookedTill: "",
          },
        };
        const updateRoom = await roomCollection.updateOne(roomFilter, roomDoc);

        const userFilter = { _id: new ObjectId(userId) };
        const userDoc = {
          $set: { room: "" },
        };
        const updateUser = await usersCollection.updateOne(userFilter, userDoc);

        res.json(updateUser);
      } else {
        const seats = currentRoom.seat;
        const roomFilter = { _id: new ObjectId(roomId) };
        const roomResidents = currentRoom.bookedBy.filter((e) => {
          return e.uid != userId;
        });
        const roomDoc = { $set: { bookedBy: roomResidents, seat: seats + 1 } };
        const updateRoom = await roomCollection.updateOne(roomFilter, roomDoc);

        const userFilter = { _id: new ObjectId(userId) };
        const userDoc = {
          $set: { room: "" },
        };
        const updateUser = await usersCollection.updateOne(userFilter, userDoc);

        res.json(updateUser);
      }

      allMeals.map(async (mealItem) => {
        const newBookedBy = mealItem.bookedBy.filter((element) => {
          return element.uid != userId;
        });
        const mealFilter = {
          _id: new ObjectId(mealItem._id),
        };
        const mealDoc = { $set: { bookedBy: newBookedBy } };

        const result = await mealCollection.updateOne(mealFilter, mealDoc);
      });

      const cancelUserMeal = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { mealPlan: [] } }
      );
    });

    //Room Selection
    app.put("/rooms", async (req, res) => {
      const currentUser = req.body.currentUser;
      const roomId = req.body.roomId;
      const rooms = await roomCollection.find({}).toArray();
      const currentRoom = await roomCollection.findOne({
        _id: new ObjectId(roomId),
      });

      var tempDate = new Date();
      tempDate.setHours(6 + tempDate.getHours(), 0, 0, 0);
      var today = new Date(tempDate.getTime());
      tempDate.setDate(tempDate.getDate() + 1);
      var tomorrow = new Date(tempDate.getTime());
      var oneMonth = new Date(today.getTime());
      oneMonth.setMonth(today.getMonth() + 1);

      if (currentRoom.category == "Business") {
        const roomFilter = { _id: new ObjectId(roomId) };
        const roomDoc = {
          $set: {
            bookedBy: currentUser,
            bookedOn: today,
            bookedTill: oneMonth,
          },
        };
        const updateRoom = await roomCollection.updateOne(roomFilter, roomDoc);

        const userFilter = { _id: new ObjectId(currentUser) };
        const userDoc = {
          $set: { room: currentRoom, bookedOn: today, bookedTill: oneMonth },
        };
        const updateUser = await usersCollection.updateOne(userFilter, userDoc);
      } else {
        let flag = true;
        currentRoom.bookedBy.map((e) => {
          if (e.uid === currentUser) {
            flag = false;
          }
        });

        if (flag) {
          const seats = currentRoom.seat;
          const roomFilter = { _id: new ObjectId(roomId) };
          const roomResidents = [
            ...currentRoom.bookedBy,
            { uid: currentUser, bookedOn: today, bookedTill: oneMonth },
          ];
          const roomDoc = {
            $set: { bookedBy: roomResidents, seat: seats - 1 },
          };
          const updateRoom = await roomCollection.updateOne(
            roomFilter,
            roomDoc
          );

          const userFilter = { _id: new ObjectId(currentUser) };
          const userDoc = {
            $set: { room: currentRoom, bookedOn: today, bookedTill: oneMonth },
          };
          const updateUser = await usersCollection.updateOne(
            userFilter,
            userDoc
          );
        }
      }
    });

    // const keepServerAlive= nodeCron.schedule("* */5 * * * *",async()=>{
    //   console.log("restarted at ", Date());
    // });

    // Repeated meal selection and room booking
    const newJob = nodeCron.schedule(
      "0 0 0 * * *",
      async () => {
        console.log("running");
        let meals = await mealCollection.find({}).toArray();
        const rooms = await roomCollection.find({}).toArray();
        const allUsers = await usersCollection.find({ role: "user" }).toArray();
        var tempDate = new Date();
        const now = new Date();
        now.setHours(6 + now.getHours());

        // tempDate.setHours(0, 0, 0, 0);
        tempDate.setHours(6 + tempDate.getHours(), 0, 0, 0);
        var today = new Date(tempDate.getTime());
        tempDate.setDate(tempDate.getDate() + 1);
        var tomorrow = new Date(tempDate.getTime());
        var oneMonth = new Date(today.getTime());
        oneMonth.setMonth(today.getMonth() + 1);

        rooms.map(async (room) => {
          const tmpDate = new Date(room?.bookedTill);

          //Private room renewal
          if (
            room.category == "Business" &&
            room.bookedBy != "" &&
            today.getTime() > tmpDate.getTime()
          ) {
            console.log("Private");
            const roomId = room._id;
            const userId = room.bookedBy;
            const userPaymentRecord = await paymentCollection.findOne({
              uid: userId,
            });

            //Update room booking date
            const roomFilter = { _id: new ObjectId(roomId) };
            const roomDoc = {
              $set: {
                bookedBy: userId,
                bookedOn: room.bookedOn,
                bookedTill: oneMonth,
              },
            };
            const updateRoom = await roomCollection.updateOne(
              roomFilter,
              roomDoc
            );

            //Update room booking date to user
            const userFilter = { _id: new ObjectId(userId) };
            const userDoc = {
              $set: {
                room: room,
                bookedOn: room.bookedOn,
                bookedTill: oneMonth,
              },
            };
            const updateUser = await usersCollection.updateOne(
              userFilter,
              userDoc
            );

            //Add rent to payment collection
            const paymentQuery = { uid: userId };
            const paymentDoc = {
              $set: {
                due: parseInt(userPaymentRecord?.due) + parseInt(room.cost),
              },
            };
            const paymentResult = await paymentCollection.updateOne(
              paymentQuery,
              paymentDoc
            );

            //Add invoice to payment history
            const paymentHistory = {
              date: now.toLocaleDateString(),
              time: now.toLocaleTimeString(),
              amount: room.cost,
              type: "Rent",
            };
            const paymentHistoryResult = await paymentCollection.updateOne(
              { uid: userId },
              {
                $push: {
                  paymentHistory: paymentHistory,
                },
              }
            );

            //Shared room renewal
          } else if (room.category == "Economic" && room.bookedBy.length > 0) {
            const roomId = room._id;

            const currentRoom = await roomCollection.findOne({
              _id: roomId,
            });

            //Selecting individual seat
            room.bookedBy.map(async (seat) => {
              if (today.getTime() > seat.bookedTill.getTime()) {
                console.log("Shared");
                const userId = seat.uid;
                const userPaymentRecord = await paymentCollection.findOne({
                  uid: userId,
                });

                //Update booking date of each seat
                const roomResidents = currentRoom.bookedBy.filter(
                  (resident) => {
                    return resident.uid != userId;
                  }
                );

                roomResidents.push({
                  uid: userId,
                  bookedOn: seat.bookedOn,
                  bookedTill: oneMonth,
                });

                const roomFilter = { _id: roomId };
                const roomDoc = {
                  $set: {
                    bookedBy: roomResidents,
                  },
                };
                const updateRoom = await roomCollection.updateOne(
                  roomFilter,
                  roomDoc
                );

                //Update booking date of seat user
                const userFilter = { _id: new ObjectId(userId) };
                const userDoc = {
                  $set: {
                    room: room,
                    bookedOn: seat.bookedOn,
                    bookedTill: oneMonth,
                  },
                };
                const updateUser = await usersCollection.updateOne(
                  userFilter,
                  userDoc
                );

                //Add seat rent to payment collection
                const paymentQuery = { uid: userId };
                const paymentDoc = {
                  $set: {
                    due: parseInt(userPaymentRecord?.due) + parseInt(room.cost),
                  },
                };
                const paymentResult = await paymentCollection.updateOne(
                  paymentQuery,
                  paymentDoc
                );

                //Add invoice to payment history
                const paymentHistory = {
                  date: now.toLocaleDateString(),
                  time: now.toLocaleTimeString(),
                  amount: room.cost,
                  type: "Rent",
                };
                const paymentHistoryResult = await paymentCollection.updateOne(
                  { uid: userId },
                  {
                    $push: {
                      paymentHistory: paymentHistory,
                    },
                  }
                );
              }
            });
          }
        });

        const users = await usersCollection.find({ role: "user" }).toArray();

        //Cancel user's meal plan if due exists for 10 days
        users.map(async (user) => {
          const date1 = new Date();
          date1.setHours(6 + date1.getHours());

          if (user?.mealPlan && !user?.room == "") {
            const roomBookedTill = new Date(user.bookedTill);
            roomBookedTill.setHours(0, 0, 0, 0);
            const roomBookedOn = new Date(user.bookedTill);
            roomBookedOn.setHours(0, 0, 0, 0);
            roomBookedOn.setMonth(roomBookedOn.getMonth() - 1);
            const plus10days = new Date(roomBookedOn);
            plus10days.setDate(roomBookedOn.getDate() + 10);

            const currentUserPayment = await paymentCollection.findOne({
              email: user.email,
            });

            if (
              today.getTime() > plus10days.getTime() &&
              parseInt(currentUserPayment.advance) <=
                parseInt(currentUserPayment.due)
            ) {
              meals.map(async (meal) => {
                const newBookedBy = meal.bookedBy.filter((e) => {
                  currentUserPayment.uid != e.uid;
                });

                const updateMeal = await mealCollection.updateOne(
                  { _id: meal._id },
                  {
                    $set: {
                      bookedBy: newBookedBy,
                    },
                  }
                );

                //Update meal in user info
                const tempMealPlan = [{}, {}, {}];
                const userMealResult = await usersCollection.updateOne(
                  { _id: user._id },
                  {
                    $set: {
                      mealPlan: tempMealPlan,
                      confirmedMealPlan: tempMealPlan,
                    },
                  }
                );
              });
            }
          }
        });

        meals = await mealCollection.find({}).toArray();
        const timeRightNow = new Date();
        timeRightNow.setHours(6 + timeRightNow.getHours());

        //New Update Meals

        meals.map(async (meal) => {
          const clearMealOrders = await mealCollection.updateOne(
            { _id: meal._id },
            {
              $set: {
                bookedBy: [],
              },
            }
          );
        });

        users.map(async (user) => {
          const userID = user._id.toString();
          if (
            (Object.keys(user.room).length != 0 || user.room != "") &&
            user.mealPlan
          ) {
            const userPayment = await paymentCollection.findOne({
              email: user.email,
            });

            //Update Dues
            let mealCost =
              (parseInt(user?.mealPlan[0]?.cost) || 0) +
              (parseInt(user?.mealPlan[1]?.cost) || 0) +
              (parseInt(user?.mealPlan[2]?.cost) || 0);
            mealCost = mealCost || 0;
            const now = new Date();
            now.setHours(6 + now.getHours());

            if (mealCost > 0) {
              const newDue = parseInt(userPayment.due) + mealCost;

              const newPaymentHistory = {
                date: now.toLocaleDateString(),
                time: now.toLocaleTimeString(),
                amount: mealCost,
                type: "Meal Charge",
              };
              console.log("Meal Cost: ", mealCost);
              const updateDue = await paymentCollection.updateOne(
                { email: user.email },
                {
                  $set: {
                    due: newDue,
                  },
                  $push: {
                    paymentHistory: newPaymentHistory,
                  },
                }
              );
            }

            //Add to confirmedMealPlan
            const addToConfirmedMealPlan = await usersCollection.updateOne(
              { _id: user._id },
              {
                $set: {
                  confirmedMealPlan: user.mealPlan,
                },
              }
            );

            //Add orders to meal bookedBy array
            if (user.mealPlan[0]?._id) {
              const newOrder = {
                uid: userID,
                mealDay: today,
              };
              const updateBookedBy = await mealCollection.updateOne(
                { _id: user.mealPlan[0]._id },
                {
                  $push: {
                    bookedBy: newOrder,
                  },
                }
              );
            }
            if (user.mealPlan[1]?._id) {
              const newOrder = {
                uid: userID,
                mealDay: today,
              };
              const updateBookedBy = await mealCollection.updateOne(
                { _id: user.mealPlan[1]._id },
                {
                  $push: {
                    bookedBy: newOrder,
                  },
                }
              );
            }
            if (user.mealPlan[2]?._id) {
              const newOrder = {
                uid: userID,
                mealDay: today,
              };
              const updateBookedBy = await mealCollection.updateOne(
                { _id: user.mealPlan[2]._id },
                {
                  $push: {
                    bookedBy: newOrder,
                  },
                }
              );
            }
          }
          if (
            (Object.keys(user.room).length == 0 || user.room == "") &&
            user?.confirmedMealPlan
          ) {
            const clearConfirmedMeal = await usersCollection.updateOne(
              { _id: user._id },
              {
                $set: {
                  confirmedMealPlan: [],
                },
              }
            );
          }
        });

        //Update meals
        // meals.map(async (meal) => {
        //   //Selecting each meal order
        //   meal.bookedBy.map(async (element) => {
        //     const currentPayment = await paymentCollection.findOne({
        //       uid: element.uid,
        //     });
        //     const currentUser = await usersCollection.findOne({
        //       _id: new ObjectId(element.uid),
        //     });

        //     //Check if user has room
        //     if (Object.keys(currentUser.room).length != 0) {
        //       var mealDate = new Date(element.mealDay.getTime());
        //       mealDate.setHours(0, 0, 0, 0);
        //       if (mealDate.getTime() < today.getTime()) {
        //         console.log("due: ", currentPayment.due);
        //         //Add meal cost to users payment
        //         const paymentQuery = { uid: element.uid };
        //         const newDue =
        //           parseInt(currentPayment?.due) + parseInt(meal?.cost);
        //         console.log("new due: ", newDue);
        //         const paymentDoc = {
        //           $set: {
        //             due: newDue,
        //           },
        //         };
        //         const payRes = await paymentCollection.updateOne(
        //           paymentQuery,
        //           paymentDoc
        //         );

        //         const tmpPay = await paymentCollection.findOne({
        //           uid: element.uid,
        //         });

        //         console.log("db due:", tmpPay.due);

        //         //Update mealDay to today in meal bookedBy array
        //         const query = {
        //           _id: new ObjectId(meal._id),
        //           "bookedBy.uid": element.uid,
        //         };
        //         const updateDoc = { $set: { "bookedBy.$.mealDay": today } };
        //         const result = await mealCollection.updateOne(query, updateDoc);

        //         //Update meal in user info
        //         const tempMealPlan = currentUser.mealPlan;
        //         const userMealResult = await usersCollection.updateOne(
        //           { _id: new ObjectId(element.uid) },
        //           {
        //             $set: {
        //               confirmedMealPlan: tempMealPlan,
        //             },
        //           }
        //         );

        //         //Add invoice to payment history
        //         const paymentHistory = {
        //           date: now.toLocaleDateString(),
        //           time: now.toLocaleTimeString(),
        //           amount: meal.cost,
        //           type: "Meal Charge",
        //         };
        //         const paymentHistoryResult = await paymentCollection.updateOne(
        //           { uid: element.uid },
        //           {
        //             $push: {
        //               paymentHistory: paymentHistory,
        //             },
        //           }
        //         );
        //       }
        //     }
        //   });
        // });
      },
      {
        scheduled: true,
        timezone: "Asia/Dhaka",
      }
    );

    //Select Meal
    app.put("/meals", async (req, res) => {
      // console.log(req.body);
      var chosenBreakfast = {};
      var chosenLunch = {};
      var chosenDinner = {};
      const breakfast = req.body.breakfast;
      const lunch = req.body.lunch;
      const dinner = req.body.dinner;
      const user = req.body.currentUser;
      var tempDate = new Date();
      // tempDate.setHours(0, 0, 0, 0);
      tempDate.setHours(6 + tempDate.getHours(), 0, 0, 0);

      var today = new Date(tempDate.getTime());
      tempDate.setDate(tempDate.getDate() + 1);
      var tomorrow = new Date(tempDate.getTime());
      var oneMonth = new Date(today.getTime());
      oneMonth.setMonth(today.getMonth() + 1);

      const allMeals = await mealCollection.find({}).toArray();

      allMeals.map(async (item) => {
        const newBooking = item.bookedBy.filter((e) => e.uid != user);

        const filter = { _id: item._id };
        const updateDoc = {
          $set: { bookedBy: newBooking },
        };
        const result = await mealCollection.updateOne(filter, updateDoc);
        // console.log(item.time, item.bookedBy);
      });

      if (breakfast.id) {
        const allBreakfasts = await mealCollection
          .find({ time: "Breakfast" })
          .toArray();

        allBreakfasts.map(async (item) => {
          const newBooking = item.bookedBy.filter(
            (element) => element.uid != user
          );

          const filter = { _id: item._id };
          const updateDoc = {
            $set: { bookedBy: newBooking },
          };
          const result = await mealCollection.updateOne(filter, updateDoc);
        });
        chosenBreakfast = await mealCollection.findOne({
          _id: new ObjectId(breakfast.id),
        });
        // console.log(chosenBreakfast);
        const booking = chosenBreakfast.bookedBy;
        // booking.push(req.body.currentUser);
        booking.push({ uid: req.body.currentUser, mealDay: today });

        const filter = { _id: new ObjectId(breakfast.id) };
        const updateDoc = {
          $set: { bookedBy: booking, mealNo: breakfast.itemPack },
        };
        const result = await mealCollection.updateOne(filter, updateDoc);
      } else {
        const allBreakfasts = await mealCollection
          .find({ time: "Breakfast" })
          .toArray();

        allBreakfasts.map(async (item) => {
          const newBooking = item.bookedBy.filter(
            (element) => element.uid != req.body.currentUser
          );

          const filter = { _id: item._id };
          const updateDoc = { $set: { bookedBy: newBooking } };
          const result = await mealCollection.updateOne(filter, updateDoc);
        });
      }

      if (lunch.id) {
        const allLunch = await mealCollection.find({ time: "Lunch" }).toArray();

        allLunch.map(async (item) => {
          const user = req.body.currentUser;
          const newBooking = item.bookedBy.filter(
            (element) => element.uid != user
          );

          const filter = { _id: item._id };
          const updateDoc = { $set: { bookedBy: newBooking } };
          const result = await mealCollection.updateOne(filter, updateDoc);
        });
        chosenLunch = await mealCollection.findOne({
          _id: new ObjectId(lunch.id),
        });
        const booking = chosenLunch.bookedBy;
        booking.push({ uid: req.body.currentUser, mealDay: today });

        const filter = { _id: new ObjectId(lunch.id) };
        const updateDoc = {
          $set: { bookedBy: booking, mealNo: lunch.itemPack },
        };
        const result = await mealCollection.updateOne(filter, updateDoc);
      } else {
        const allLunch = await mealCollection.find({ time: "Lunch" }).toArray();

        allLunch.map(async (item) => {
          const newBooking = item.bookedBy.filter(
            (element) => element.uid != req.body.currentUser
          );

          const filter = { _id: item._id };
          const updateDoc = { $set: { bookedBy: newBooking } };
          const result = await mealCollection.updateOne(filter, updateDoc);
        });
      }

      if (dinner.id) {
        const allDinner = await mealCollection
          .find({ time: "Dinner" })
          .toArray();

        allDinner.map(async (item) => {
          const user = req.body.currentUser;
          const newBooking = item.bookedBy.filter(
            (element) => element.uid != user
          );

          const filter = { _id: item._id };
          const updateDoc = { $set: { bookedBy: newBooking } };
          const result = await mealCollection.updateOne(filter, updateDoc);
        });
        chosenDinner = await mealCollection.findOne({
          _id: new ObjectId(dinner.id),
        });
        const booking = chosenDinner.bookedBy;
        booking.push({ uid: req.body.currentUser, mealDay: today });

        const filter = { _id: new ObjectId(dinner.id) };
        const updateDoc = {
          $set: { bookedBy: booking, mealNo: dinner.itemPack },
        };
        const result = await mealCollection.updateOne(filter, updateDoc);
      } else {
        const allDinner = await mealCollection
          .find({ time: "Dinner" })
          .toArray();

        allDinner.map(async (item) => {
          const newBooking = item.bookedBy.filter(
            (element) => element.uid != req.body.currentUser
          );

          const filter = { _id: item._id };
          const updateDoc = { $set: { bookedBy: newBooking } };
          const result = await mealCollection.updateOne(filter, updateDoc);
        });
      }

      const doc = await mealCollection.find({}).toArray();

      const userDoc = {
        $set: { mealPlan: [chosenBreakfast, chosenLunch, chosenDinner] },
      };
      const userMealResult = await usersCollection.updateOne(
        { _id: new ObjectId(user) },
        userDoc
      );
      // console.log(doc);
      res.send(doc);
    });

    //Remove user from Admin position - Christos
    app.put("/users", async (req, res) => {
      const filter = { email: req.body.email };
      const updateDoc = { $set: { role: "user" } };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Get unoccupied rooms - Christos
    app.get("/unoccupiedRooms", async (req, res) => {
      const query = { bookedBy: "" };
      const cursor = await roomCollection.find(query).toArray();
      res.send(cursor);
    });

    // Get occupied rooms - Christos
    app.get("/occupiedRooms", async (req, res) => {
      const query = { category: "Economic" };
      const sharedRooms = await roomCollection.find(query).toArray();
      const cursor = sharedRooms.filter(
        (e) => parseInt(e.seat) > 0 && parseInt(e.seat) < 4
      );
      res.send(cursor);
    });

    // Get full rooms - Christos
    app.get("/fullRooms", async (req, res) => {
      const sharedRooms = await roomCollection
        .find({ category: "Economic" })
        .toArray();
      const privateRooms = await roomCollection
        .find({ category: "Business" })
        .toArray();
      const cursor1 = sharedRooms.filter((e) => parseInt(e.seat) == 0);

      const cursor2 = privateRooms.filter(
        (e) => e.bookedBy != "" && e.bookedBy != []
      );

      const cursor = cursor1.concat(cursor2);
      res.send(cursor);
    });

    // Get user info by ID - Christos
    app.get("/users/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // Get room info by userID - Christos
    app.get("/roomsByUid/:uid", async (req, res) => {
      const userId = req.params.uid;
      let roomInfo = {};
      const rooms = await roomCollection.find({}).toArray();

      rooms.map((room) => {
        if (room.category == "Business" && room.bookedBy == userId) {
          roomInfo = {
            _id: room._id,
            branch: room.branch,
            category: "Private",
            roomNo: room.roomNo,
            rent: room.cost,
            bookedOn: room.bookedOn,
            bookedTill: room.bookedTill,
          };
        }
        if (room.category == "Economic" && room.bookedBy.length > 0) {
          room.bookedBy.map((seat) => {
            if (seat.uid == userId) {
              roomInfo = {
                _id: room._id,
                roomNo: room.roomNo,
                branch: room.branch,
                rent: room.cost,
                category: "Shared",
                bookedOn: seat.bookedOn,
                bookedTill: seat.bookedTill,
              };
            }
          });
        }
      });
      res.json(roomInfo);
    });

    // Delete user by ID - Christos
    app.delete("/users/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await usersCollection.deleteOne(query);
      res.json(result);
      console.log("Deleted item successfully");
      console.log(result);
    });

    //SSL Commerz

    app.post("/order", async (req, res) => {
      const tran_id = new ObjectId().toString();
      const reqBody = req.body;
      const data = {
        total_amount: reqBody.invoice,
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `https://hostel-hub-yg4y.onrender.com/order/success/${tran_id}`,
        fail_url: `https://hostel-hub-yg4y.onrender.com/order/fail/${tran_id}`,
        cancel_url: "https://hostel-hub-client.vercel.app/dashboard",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: reqBody.productCategory,
        product_profile: "general",
        cus_name: reqBody.user.displayName,
        cus_email: reqBody.user.email,
        cus_add1: reqBody.user.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: reqBody.user.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        const finalOrder = {
          reqBody,
          paidStatus: false,
          transactionID: tran_id,
        };

        const result = orderCollection.insertOne(finalOrder);
        console.log("Redirecting to: ", GatewayPageURL);
      });
    });

    //SSL payment failed
    app.post("/order/fail/:tran_id", async (req, res) => {
      const order = await orderCollection.findOne({
        transactionID: req.params.tran_id,
      });

      if (order.reqBody.productCategory == "Payment") {
        res.redirect("https://hostel-hub-client.vercel.app/dashboard/payment");
      }
      if (order.reqBody.productCategory == "Room Booking") {
        res.redirect(
          `https://hostel-hub-client.vercel.app/dashboard/rooms/bookRoom`
        );
      }
    });

    //SSL payment successful
    app.post("/order/success/:tran_id", async (req, res) => {
      var tempDate = new Date();
      const now = new Date();
      // tempDate.setHours(0, 0, 0, 0);
      tempDate.setHours(6 + tempDate.getHours(), 0, 0, 0);

      now.setHours(6 + now.getHours());

      var today = new Date(tempDate.getTime());
      tempDate.setDate(tempDate.getDate() + 1);
      var tomorrow = new Date(tempDate.getTime());
      var oneMonth = new Date(today.getTime());
      oneMonth.setMonth(today.getMonth() + 1);

      console.log(req.params.tran_id);

      const order = await orderCollection.findOne({
        transactionID: req.params.tran_id,
      });

      if (order.reqBody.productCategory == "Room Booking") {
        console.log(order.reqBody);

        const room = await roomCollection.findOne({
          _id: new ObjectId(order.reqBody.room._id),
        });

        const bookingItem = {
          uid: order.reqBody.user._id,
          bookedOn: today,
          bookedTill: oneMonth,
        };

        const paymentHistoryItem = {
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          amount: order.reqBody.invoice,
          type: "Room Booking",
        };

        if (order.reqBody.room.category == "Economic") {
          const updateRoom = await roomCollection.updateOne(
            { _id: new ObjectId(order.reqBody.room._id) },
            {
              $push: {
                bookedBy: bookingItem,
              },
              $inc: {
                seat: -1,
              },
            }
          );
        }

        if (order.reqBody.room.category == "Business") {
          const updateRoom = await roomCollection.updateOne(
            { _id: new ObjectId(order.reqBody.room._id) },
            {
              $set: {
                bookedBy: order.reqBody.user._id,
                bookedOn: today,
                bookedTill: oneMonth,
              },
            }
          );
        }

        const updateUser = await usersCollection.updateOne(
          { _id: new ObjectId(order.reqBody.user._id) },
          {
            $set: {
              room: room,
              bookedOn: today,
              bookedTill: oneMonth,
            },
          }
        );

        const updatePayment = await paymentCollection.updateOne(
          { _id: new ObjectId(order.reqBody.payInfo._id) },
          {
            $push: {
              paymentHistory: paymentHistoryItem,
            },
            $set: {
              advance: 5000,
              due: 0,
            },
          }
        );
      }

      if (order.reqBody.productCategory == "Payment") {
        const paymentHistoryItem = {
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          amount: order.reqBody.invoice,
          type: "Payment",
        };
        const paymentAmount = order.reqBody.invoice;
        const updatePayment = await paymentCollection.updateOne(
          { _id: new ObjectId(order.reqBody.payInfo._id) },
          {
            $inc: {
              due: -paymentAmount,
            },
            $push: {
              paymentHistory: paymentHistoryItem,
            },
          }
        );
      }

      const result = await orderCollection.updateOne(
        { transactionID: req.params.tran_id },
        {
          $set: {
            paidStatus: true,
          },
        }
      );

      res.redirect("https://hostel-hub-client.vercel.app/dashboard");
    });
  } finally {
    // await client.close()
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`<h1>Hostel Hub Server Running</h1>`);
});

app.listen(port, () => {
  console.log(`Listening port: ${port}`);
});
