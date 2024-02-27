import bcrypt from "bcrypt"

const password = "123456789"

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
