import bcrypt from 'bcrypt'

const password = '%F)UsiS)AynL'

const saltRounds = 10 // default

bcrypt.genSalt(saltRounds, function (err, salt) {
  if (err) {
    console.error(err)
    return
  }

  bcrypt.hash(password, salt, function (err, hash) {
    if (err) {
      console.error(err)
      return
    }

    console.log(`Hashed password: ${hash}`)
  })
})

// $2b$10$Likqzj3wID7S9I5kIz67LuVQG4QImXnH72X9RFdUc9NlcJcoJcAvy - kyon
// $2b$10$UW9ETrREXnTokIE8vMJUuuzZ47S8tMjLRGx3b0B7BjC9jMV8jVrE6 - node guy
//
