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

// $2b$10$6LbEUrJ0IL.D/cdHidW1CemQ24YEotOmq8st0rgn2sCKjUsxh2saS
// $2b$10$w4u4nUmWW7rFC2eC17Yw.e0ut0ASMBDNYHRKJteS8S/CthsrtyhnO
